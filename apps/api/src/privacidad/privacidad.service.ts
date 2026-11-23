import { Injectable, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { db, usuario, expedientePrivacidad, expedienteEvento, auditoriaOperacion } from '@audivare/database';
import { eq, desc, and, lt, or } from 'drizzle-orm';
import { UUID_VALIDO } from './auditoria-http';

export const TIPOS_PRIVACIDAD = ['ACCESO', 'RECTIFICACION', 'CANCELACION', 'OPOSICION', 'PORTABILIDAD', 'INFORMACION', 'ENTREGA'] as const;
type Tipo = (typeof TIPOS_PRIVACIDAD)[number];
function texto(value: unknown, max: number): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw new BadRequestException('Datos incompletos o demasiado extensos');
  return value.trim();
}
export function validarSolicitud(body: unknown) {
  if (!body || typeof body !== 'object') throw new BadRequestException('Solicitud inválida');
  const b = body as Record<string, unknown>;
  const tipo = texto(b.tipo, 30);
  if (!TIPOS_PRIVACIDAD.includes(tipo as Tipo)) throw new BadRequestException('Tipo de solicitud inválido');
  const correo = texto(b.correo, 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) throw new BadRequestException('Correo inválido');
  return { tipo, correo, descripcion: texto(b.descripcion, 2000) };
}
@Injectable()
export class PrivacidadService {
  async propietario(actorId: string) {
    if (!UUID_VALIDO.test(actorId)) throw new ForbiddenException('Acceso restringido al propietario');
    const [u] = await db.select({ principal: usuario.esSuperadminPrincipal, tipo: usuario.tipoUsuario }).from(usuario).where(eq(usuario.id, actorId));
    if (!u?.principal || u.tipo !== 'SUPERADMIN') throw new ForbiddenException('Acceso restringido al propietario');
  }
  async recibir(body: unknown) {
    const datos = validarSolicitud(body);
    const [r] = await db.insert(expedientePrivacidad).values(datos).returning({ id: expedientePrivacidad.id, fecha: expedientePrivacidad.creadaEn });
    return { referencia: r.id, recibida_en: r.fecha, message: 'Solicitud recibida. Conserva la referencia. La recepción no verifica tu identidad ni autoriza entrega o eliminación.' };
  }
  async incidente(actorId: string, descripcion: unknown) {
    await this.propietario(actorId);
    const detalle = texto(descripcion, 2000);
    return db.transaction(async tx => {
      const [r] = await tx.insert(expedientePrivacidad).values({ tipo: 'INCIDENTE', descripcion: detalle }).returning();
      await tx.insert(expedienteEvento).values({ expedienteId: r.id, actorId, estado: 'RECIBIDA', nota: 'Incidente interno abierto; registrar hora de conocimiento, alcance, contención y avisos aplicables.' });
      return r;
    });
  }
  async listar(actorId: string, antes?: string) {
    await this.propietario(actorId);
    const cursor = this.cursor(antes);
    return db.select().from(expedientePrivacidad).where(cursor ? or(lt(expedientePrivacidad.creadaEn, cursor.fecha),
      and(eq(expedientePrivacidad.creadaEn, cursor.fecha), lt(expedientePrivacidad.id, cursor.id))) : undefined)
      .orderBy(desc(expedientePrivacidad.creadaEn), desc(expedientePrivacidad.id)).limit(100);
  }
  async detalle(actorId: string, id: string) {
    await this.propietario(actorId);
    if (!UUID_VALIDO.test(id)) throw new BadRequestException('Referencia inválida');
    const [r] = await db.select().from(expedientePrivacidad).where(eq(expedientePrivacidad.id, id));
    if (!r) throw new NotFoundException('Solicitud no encontrada');
    const eventos = await db.select().from(expedienteEvento).where(eq(expedienteEvento.expedienteId, id)).orderBy(expedienteEvento.fecha);
    return { ...r, eventos };
  }
  async actualizar(actorId: string, id: string, body: unknown) {
    await this.propietario(actorId);
    if (!UUID_VALIDO.test(id) || !body || typeof body !== 'object') throw new BadRequestException('Solicitud inválida');
    const b = body as Record<string, unknown>, estado = texto(b.estado, 20), nota = texto(b.nota, 2000);
    if (!['RECIBIDA', 'VERIFICADA', 'DERIVADA', 'RESPONDIDA'].includes(estado)) throw new BadRequestException('Estado inválido');
    let plazoEn: Date | undefined;
    if (b.plazo_en !== undefined) {
      if (typeof b.plazo_en !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(b.plazo_en)) throw new BadRequestException('Plazo inválido');
      plazoEn = new Date(b.plazo_en);
      if (!Number.isFinite(plazoEn.getTime())) throw new BadRequestException('Plazo inválido');
    }
    return db.transaction(async tx => {
      const [r] = await tx.select().from(expedientePrivacidad).where(eq(expedientePrivacidad.id, id)).for('update');
      if (!r) throw new NotFoundException('Solicitud no encontrada');
      if (r.estado === 'RESPONDIDA') throw new BadRequestException('La solicitud ya está cerrada');
      if (estado === 'RESPONDIDA' && r.tipo !== 'INCIDENTE' && !r.verificadaEn) throw new BadRequestException('Verifica la identidad antes de cerrar la solicitud');
      if (plazoEn && plazoEn < r.creadaEn) throw new BadRequestException('El plazo no puede preceder a la recepción');
      await tx.insert(expedienteEvento).values({ expedienteId: id, actorId, estado, nota });
      const [result] = await tx.update(expedientePrivacidad).set({ estado,
        ...(estado === 'VERIFICADA' && !r.verificadaEn ? { verificadaEn: new Date() } : {}),
        ...(plazoEn ? { plazoEn } : {}),
      }).where(eq(expedientePrivacidad.id, id)).returning();
      return result;
    });
  }
  async auditoria(actorId: string, antes?: string) {
    await this.propietario(actorId);
    const cursor = this.cursor(antes);
    return db.select().from(auditoriaOperacion).where(cursor ? or(lt(auditoriaOperacion.iniciadaEn, cursor.fecha),
      and(eq(auditoriaOperacion.iniciadaEn, cursor.fecha), lt(auditoriaOperacion.id, cursor.id))) : undefined)
      .orderBy(desc(auditoriaOperacion.iniciadaEn), desc(auditoriaOperacion.id)).limit(100);
  }
  private cursor(value?: string) {
    if (!value) return undefined;
    const [raw, id, extra] = value.split('|'), fecha = new Date(raw);
    if (extra !== undefined || !id || !UUID_VALIDO.test(id) || !Number.isFinite(fecha.getTime())) throw new BadRequestException('Referencia de página inválida');
    return { fecha, id };
  }
}
