import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { db, empresa, pagoSuscripcion, suscripcionAviso, MetadataNotificacion } from '@audivare/database';
import { eq, desc, sql } from 'drizzle-orm';
import { NotificacionesService, DbExecutor } from '../notificaciones/notificaciones.service';
import { PermisosService } from '../common/permisos/permisos.service';
import { finAccesoPago } from '../common/acceso-empresa.util';
import { AvisoAcceso, planAvisoNuevo, fechaPeru } from './aviso-suscripcion.util';

/** Días de gracia tras el vencimiento antes de suspender automáticamente. */
export const DIAS_GRACIA = 7;

// ---- Helpers de fechas del ciclo (día calendario local, sin hora) ----

function soloFecha(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Suma meses respetando el fin de mes (31 ene + 1 mes = 28/29 feb). */
function sumarMeses(fecha: Date, meses: number): Date {
  const r = new Date(fecha);
  const dia = r.getDate();
  r.setMonth(r.getMonth() + meses);
  if (r.getDate() < dia) r.setDate(0);
  return r;
}

function sumarDias(fecha: Date, dias: number): Date {
  const r = new Date(fecha);
  r.setDate(r.getDate() + dias);
  return r;
}

/** 'YYYY-MM-DD' (columna date) → Date a medianoche local. */
function parseFechaLocal(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function aISO(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function aLegible(d: Date): string {
  return d.toLocaleDateString('es-PE');
}

export interface CicloPagoEmpresa {
  ultimo_pago: { fecha: string; monto: string; duracion_meses: number } | null;
  /** Vencimiento del ciclo: fecha del último pago + su duración en meses. */
  fecha_vencimiento: string;
  /** Fecha en que se suspende automáticamente si no se registra un pago. */
  fecha_suspension: string;
  estado_pago: 'AL_DIA' | 'VENCIDO';
  prueba_hasta?: string | null;
}

/**
 * Pago manual del servicio AudiVare. El superadmin registra monto, fecha y meses
 * cubiertos; el ciclo vence al terminar ese periodo. Al vencer se notifica al
 * superadmin y a la empresa. Registros nuevos bloquean por vigencia en cada petición
 * y reciben avisos de prueba/pago sin cambiar su estado manual. Empresas anteriores
 * conservan suspensión automática, gracia y ciclo inicial de un mes sin pagos.
 */
@Injectable()
export class SuscripcionesService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(SuscripcionesService.name);
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly notificacionesService: NotificacionesService,
    private readonly permisosService: PermisosService,
  ) {}

  // Chequeo al arrancar (recupera lo pendiente si el servidor estuvo apagado)
  // y luego cada hora. Idempotente: el aviso se envía una vez por ciclo y la
  // suspensión solo actúa sobre empresas aún activas.
  onApplicationBootstrap() {
    void this.revisarVencimientos();
    this.timer = setInterval(() => void this.revisarVencimientos(), 60 * 60 * 1000);
    this.timer.unref();
  }

  onApplicationShutdown() {
    if (this.timer) clearInterval(this.timer);
  }

  /** Ciclo de pago vigente de una empresa (para la lista del superadmin y el detalle). */
  async getCiclo(empresaId: string, fechaCreacion: Date | null, pruebaHasta?: Date | null, executor: DbExecutor = db): Promise<CicloPagoEmpresa> {
    const [ultimo] = await executor
      .select({
        fecha: pagoSuscripcion.fechaPago,
        monto: pagoSuscripcion.monto,
        duracionMeses: pagoSuscripcion.duracionMeses,
      })
      .from(pagoSuscripcion)
      .where(eq(pagoSuscripcion.empresaId, empresaId))
      .orderBy(desc(pagoSuscripcion.fechaPago), desc(pagoSuscripcion.fechaRegistro))
      .limit(1);

    const hoy = soloFecha(new Date());
    if (pruebaHasta && !ultimo) {
      const fecha = pruebaHasta.toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
      return { ultimo_pago: null, fecha_vencimiento: fecha, fecha_suspension: fecha,
        estado_pago: new Date() >= pruebaHasta ? 'VENCIDO' : 'AL_DIA', prueba_hasta: pruebaHasta.toISOString() };
    }
    if (pruebaHasta && ultimo) {
      const suspension = finAccesoPago({ fechaPago: ultimo.fecha, duracionMeses: ultimo.duracionMeses });
      const vencimiento = new Date(suspension.getTime() - DIAS_GRACIA * 86400000);
      return { ultimo_pago: { fecha: ultimo.fecha, monto: ultimo.monto, duracion_meses: ultimo.duracionMeses },
        fecha_vencimiento: vencimiento.toISOString().slice(0, 10), fecha_suspension: suspension.toISOString().slice(0, 10),
        estado_pago: new Date() >= vencimiento ? 'VENCIDO' : 'AL_DIA', prueba_hasta: pruebaHasta.toISOString() };
    }
    const base = ultimo ? parseFechaLocal(ultimo.fecha) : soloFecha(fechaCreacion ?? new Date());
    const vencimiento = sumarMeses(base, ultimo?.duracionMeses ?? 1);

    return {
      ultimo_pago: ultimo
        ? { fecha: ultimo.fecha, monto: ultimo.monto, duracion_meses: ultimo.duracionMeses }
        : null,
      fecha_vencimiento: aISO(vencimiento),
      fecha_suspension: aISO(sumarDias(vencimiento, DIAS_GRACIA)),
      estado_pago: hoy >= vencimiento ? 'VENCIDO' : 'AL_DIA',
    };
  }

  /** Historial de pagos del servicio de una empresa + su ciclo vigente. */
  async getPagos(empresaId: string) {
    const [emp] = await db.select().from(empresa).where(eq(empresa.id, empresaId));
    if (!emp) throw new NotFoundException('Empresa no encontrada');

    const pagos = await db
      .select({
        id: pagoSuscripcion.id,
        monto: pagoSuscripcion.monto,
        fecha_pago: pagoSuscripcion.fechaPago,
        duracion_meses: pagoSuscripcion.duracionMeses,
        fecha_registro: pagoSuscripcion.fechaRegistro,
      })
      .from(pagoSuscripcion)
      .where(eq(pagoSuscripcion.empresaId, empresaId))
      .orderBy(desc(pagoSuscripcion.fechaPago), desc(pagoSuscripcion.fechaRegistro));

    return {
      data: pagos,
      total: pagos.length,
      ciclo: await this.getCiclo(empresaId, emp.fechaCreacion, emp.pruebaHasta),
      estado_suscripcion: emp.estadoSuscripcion,
    };
  }

  /**
   * Registra un pago con monto, fecha y duración. Si la empresa estaba suspendida
   * por falta de pago, se reactiva automáticamente.
   */
  async registrarPago(
    actorId: string,
    empresaId: string,
    montoRaw: unknown,
    fechaPagoRaw: unknown,
    duracionMesesRaw: unknown,
  ) {
    const montoVacio = montoRaw === null
      || montoRaw === undefined
      || (typeof montoRaw === 'string' && montoRaw.trim() === '');
    const monto = montoVacio ? Number.NaN : Number(montoRaw);
    if (!Number.isFinite(monto) || monto < 0) {
      throw new BadRequestException('El monto debe ser un número mayor o igual a 0');
    }
    if (monto > 9_999_999_999) {
      throw new BadRequestException('El monto excede el máximo permitido');
    }

    if (typeof fechaPagoRaw !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(fechaPagoRaw)) {
      throw new BadRequestException('fecha_pago debe tener formato YYYY-MM-DD');
    }
    const fechaPago = parseFechaLocal(fechaPagoRaw);
    if (isNaN(fechaPago.getTime()) || aISO(fechaPago) !== fechaPagoRaw) {
      throw new BadRequestException('fecha_pago no es una fecha válida');
    }
    if (fechaPago > soloFecha(new Date())) {
      throw new BadRequestException('fecha_pago no puede ser futura');
    }

    const duracionMeses = duracionMesesRaw === undefined ? 1 : Number(duracionMesesRaw);
    if (!Number.isInteger(duracionMeses) || ![1, 3, 6, 12].includes(duracionMeses)) {
      throw new BadRequestException('duracion_meses debe ser 1, 3, 6 o 12');
    }

    // El mismo bloqueo que utiliza el proceso de avisos: leer estado después de esperar.
    const { emp, activadaPrimerPago, reactivada } = await db.transaction(async (tx) => {
      const [emp] = await tx.select().from(empresa).where(eq(empresa.id, empresaId)).for('update');
      if (!emp) throw new NotFoundException('Empresa no encontrada');
      const activadaPrimerPago = emp.estadoSuscripcion === 'PENDIENTE';
      const reactivada = emp.estadoSuscripcion === 'SUSPENDIDO' && emp.suspendidaPorPago;
      await tx.insert(pagoSuscripcion).values({ empresaId, monto: monto.toFixed(2),
        fechaPago: fechaPagoRaw, duracionMeses, registradoPor: actorId,
        // now() refleja inicio de transacción, anterior a la espera por bloqueo.
        fechaRegistro: sql`clock_timestamp()`,
      });
      await tx.update(empresa).set({ ultimoAvisoPago: null,
        ...(activadaPrimerPago || reactivada ? { estadoSuscripcion: 'ACTIVO' as const, suspendidaPorPago: false } : {}),
      }).where(eq(empresa.id, empresaId));
      return { emp, activadaPrimerPago, reactivada };
    });

    const mensaje = activadaPrimerPago
      ? 'Pago registrado; la empresa fue activada'
      : reactivada
        ? 'Pago registrado; la empresa fue reactivada'
        : 'Pago registrado';

    return {
      empresa_id: empresaId,
      activada: activadaPrimerPago,
      reactivada,
      ciclo: await this.getCiclo(empresaId, emp.fechaCreacion, emp.pruebaHasta),
      mensaje,
    };
  }

  /** Recupera el estado actual al arrancar y cada hora; cada empresa tiene su transacción. */
  async revisarVencimientos() {
    try {
      const empresas = await db.select({ id: empresa.id }).from(empresa).where(eq(empresa.estadoSuscripcion, 'ACTIVO'));
      for (const emp of empresas) {
        try { await this.revisarEmpresaVencimiento(emp.id); }
        catch { this.logger.error('No se pudo registrar un aviso de suscripción; se reintentará en la siguiente revisión'); }
      }
    } catch { this.logger.error('No se pudo iniciar la revisión de suscripciones'); }
  }

  /** Sin endpoint público. El instante opcional permite comprobar fronteras en pruebas. */
  async revisarEmpresaVencimiento(empresaId: string, instante?: Date) {
    return db.transaction(async tx => {
      const [emp] = await tx.select().from(empresa).where(eq(empresa.id, empresaId)).for('update');
      if (!emp || emp.estadoSuscripcion !== 'ACTIVO') return;
      const ahora = instante ?? new Date();
      const [ultimo] = await tx.select().from(pagoSuscripcion).where(eq(pagoSuscripcion.empresaId, empresaId))
        .orderBy(desc(pagoSuscripcion.fechaPago), desc(pagoSuscripcion.fechaRegistro)).limit(1);
      let aviso: AvisoAcceso | undefined;
      if (emp.pruebaHasta) aviso = planAvisoNuevo(emp, ultimo, ahora);
      else {
        // Empresas anteriores conservan fechas/calendario y suspensión automática históricos.
        const ciclo = await this.getCiclo(empresaId, emp.fechaCreacion, null, tx);
        const vencimiento = parseFechaLocal(ciclo.fecha_vencimiento), hasta = parseFechaLocal(ciclo.fecha_suspension);
        if (soloFecha(ahora) < vencimiento) return;
        const etapa = soloFecha(ahora) >= hasta ? 'BLOQUEADO' : 'VENCIDO';
        if (etapa === 'VENCIDO' && emp.ultimoAvisoPago && soloFecha(emp.ultimoAvisoPago) >= vencimiento) return;
        aviso = { ciclo: ultimo ? `pago:${ultimo.id}` : `inicial:${ciclo.fecha_vencimiento}`,
          etapa, origen: 'ANTERIOR', vencimiento, hasta };
      }
      if (!aviso) return;
      // El marcador y todos los destinatarios se confirman o revierten juntos.
      const [creado] = await tx.insert(suscripcionAviso).values({ empresaId, ciclo: aviso.ciclo, etapa: aviso.etapa })
        .onConflictDoNothing().returning({ id: suscripcionAviso.id });
      if (!creado) {
        // Una reactivación manual del modelo anterior no convierte un ciclo vencido
        // en acceso indefinido; conserva su suspensión histórica sin repetir el aviso.
        if (aviso.origen === 'ANTERIOR' && aviso.etapa === 'BLOQUEADO') {
          await tx.update(empresa).set({ estadoSuscripcion: 'SUSPENDIDO', suspendidaPorPago: true }).where(eq(empresa.id, empresaId));
        }
        return;
      }
      if (aviso.origen === 'ANTERIOR') {
        await tx.update(empresa).set({ ultimoAvisoPago: ahora,
          ...(aviso.etapa === 'BLOQUEADO' ? { estadoSuscripcion: 'SUSPENDIDO' as const, suspendidaPorPago: true } : {}),
        }).where(eq(empresa.id, empresaId));
      }
      const nombre = emp.razonSocial ?? emp.emailRegistro;
      const prueba = aviso.origen === 'PRUEBA', bloqueado = aviso.etapa === 'BLOQUEADO';
      const fecha = aviso.origen === 'ANTERIOR' ? aLegible(aviso.vencimiento) : fechaPeru(aviso.vencimiento);
      const limite = aviso.origen === 'ANTERIOR' ? aLegible(aviso.hasta) : fechaPeru(aviso.hasta);
      const titulo = prueba ? 'Prueba de siete días finalizada' : bloqueado ? 'Acceso vencido por falta de renovación' : 'Suscripción del servicio vencida';
      const mensaje = prueba
        ? `La prueba de siete días de AudiVare finalizó el ${fecha}. Coordina con el administrador de la plataforma el registro de un periodo vigente para recuperar el acceso. Tus documentos se conservan.`
        : bloqueado
          ? `El periodo de AudiVare venció el ${fecha} y finalizó la gracia el ${limite}. Coordina la renovación con el administrador de la plataforma para recuperar el acceso. Tus documentos se conservan.`
          : `El periodo de AudiVare venció el ${fecha}. Coordina la renovación con el administrador de la plataforma antes del ${limite} para conservar el acceso.`;
      await this.notificarAmbasPartes(tx, empresaId,
        bloqueado ? 'EMPRESA_SUSPENDIDA_POR_PAGO' : 'PAGO_SUSCRIPCION_VENCIDO',
        { titulo, mensaje: `${nombre}: ${mensaje}` }, { titulo, mensaje },
        { empresa_nombre: nombre, fecha_vencimiento: aviso.origen === 'ANTERIOR' ? aISO(aviso.vencimiento)
          : aviso.vencimiento.toLocaleDateString('en-CA', { timeZone: 'America/Lima' }),
          origen_acceso: aviso.origen, etapa_acceso: aviso.etapa, ciclo_suscripcion: aviso.ciclo, acceso_hasta: aviso.hasta.toISOString() });
    });
  }

  private async notificarAmbasPartes(
    tx: DbExecutor,
    empresaId: string,
    tipo: 'PAGO_SUSCRIPCION_VENCIDO' | 'EMPRESA_SUSPENDIDA_POR_PAGO',
    paraSuperadmin: { titulo: string; mensaje: string },
    paraEmpresa: { titulo: string; mensaje: string },
    metadata: MetadataNotificacion,
  ) {
    const meta = { empresa_id: empresaId, ...metadata };

    for (const adminId of await this.permisosService.getSuperadminsGestionEmpresa(tx)) {
      await this.notificacionesService.crearNotificacion(
        adminId, tipo, paraSuperadmin.titulo, paraSuperadmin.mensaje.slice(0, 500), meta, tx,
      );
    }
    for (const usuarioId of await this.permisosService.getUsuariosConPermiso(empresaId, 'USUARIO_MANAGE', undefined, tx)) {
      await this.notificacionesService.crearNotificacion(
        usuarioId, tipo, paraEmpresa.titulo, paraEmpresa.mensaje.slice(0, 500), meta, tx,
      );
    }
  }

}
