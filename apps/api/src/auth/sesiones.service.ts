import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { db, sesion, usuario } from '@audivare/database';
import { and, eq, gt } from 'drizzle-orm';
import { PermisosService } from '../common/permisos/permisos.service';
import type { JwtPayload, TipoUsuario, UsuarioAutenticado } from '../common/tipos';
import type { DbExecutor } from '../notificaciones/notificaciones.service';

export const DURACION_SESION_SEGUNDOS = 8 * 60 * 60;
export const JWT_ISSUER = 'audivare-api';
export const JWT_AUDIENCE = 'audivare-web';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class SesionesService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly permisosService: PermisosService,
  ) {}

  async crear(user: { id: string; email: string; tipoUsuario: TipoUsuario; nombreCompleto: string | null }, executor: DbExecutor = db) {
    const ahora = Math.floor(Date.now() / 1000);
    const exp = ahora + DURACION_SESION_SEGUNDOS;
    const [registro] = await executor.insert(sesion).values({
      usuarioId: user.id,
      fechaExpiracion: new Date(exp * 1000),
    }).returning({ id: sesion.id });

    const payload = {
      sub: user.id,
      sid: registro.id,
      email: user.email,
      tipo_usuario: user.tipoUsuario,
      nombre_completo: user.nombreCompleto,
      iat: ahora,
      exp,
    };
    return {
      access_token: await this.jwtService.signAsync(payload, {
        algorithm: 'HS256', issuer: JWT_ISSUER, audience: JWT_AUDIENCE,
      }),
      tipo_usuario: user.tipoUsuario,
      expires_in: DURACION_SESION_SEGUNDOS,
    };
  }

  private comprobarPayload(payload: JwtPayload) {
    if (!payload || typeof payload.sub !== 'string' || !UUID.test(payload.sub)
      || typeof payload.sid !== 'string' || !UUID.test(payload.sid)
      || !Number.isFinite(payload.exp) || payload.exp <= Date.now() / 1000) {
      throw new UnauthorizedException('Tu sesión venció. Inicia sesión nuevamente.');
    }
  }

  async validar(payload: JwtPayload): Promise<UsuarioAutenticado> {
    this.comprobarPayload(payload);
    const [actual] = await db.select({
      id: usuario.id, email: usuario.email, tipoUsuario: usuario.tipoUsuario,
    }).from(sesion)
      .innerJoin(usuario, eq(usuario.id, sesion.usuarioId))
      .where(and(
        eq(sesion.id, payload.sid),
        eq(sesion.usuarioId, payload.sub),
        gt(sesion.fechaExpiracion, new Date()),
      ));

    if (!actual || actual.tipoUsuario !== payload.tipo_usuario) {
      throw new UnauthorizedException('Tu sesión ya no está vigente. Inicia sesión nuevamente.');
    }
    if (actual.tipoUsuario === 'INTERNO') {
      // También bloquea una sesión ya abierta si se desactiva el usuario/empresa.
      await this.permisosService.getEmpresaId(actual.id);
    }
    return { id: actual.id, email: actual.email, tipo_usuario: actual.tipoUsuario, session_id: payload.sid };
  }

  async revocarToken(token: string | undefined, auditar?: (actor: { id: string; session_id: string }) => void) {
    if (!token) throw new UnauthorizedException();
    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
        algorithms: ['HS256'], issuer: JWT_ISSUER, audience: JWT_AUDIENCE,
      });
    } catch {
      throw new UnauthorizedException('Sesión inválida o vencida');
    }
    this.comprobarPayload(payload);
    // No exige empresa activa: un usuario suspendido también puede cerrar sesión.
    auditar?.({ id: payload.sub, session_id: payload.sid });
    // Borrar solo esta sesión es idempotente y conserva las de otros dispositivos.
    await db.delete(sesion).where(and(eq(sesion.id, payload.sid), eq(sesion.usuarioId, payload.sub)));
    return { success: true };
  }
}
