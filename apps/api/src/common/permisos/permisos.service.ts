import { Injectable, ForbiddenException } from '@nestjs/common';
import { db, empresa, pagoSuscripcion, usuario, usuarioInternoEmpresa, rol, rolPermiso, permiso, superadminPermiso } from '@audivare/database';
import { eq, and, or, desc } from 'drizzle-orm';
import { calcularAccesoEmpresa } from '../acceso-empresa.util';
import type { DbExecutor } from '../../notificaciones/notificaciones.service';

@Injectable()
export class PermisosService {
  /**
   * Resuelve la empresa del usuario interno verificando que el vínculo esté
   * activo (usuario_interno_empresa.estado = true) y que la suscripción de la
   * empresa no esté suspendida.
   */
  async getEmpresaId(userId: string): Promise<string> {
    const uie = await db
      .select()
      .from(usuarioInternoEmpresa)
      .where(eq(usuarioInternoEmpresa.usuarioId, userId));

    if (!uie.length || !uie[0].estado) {
      throw new ForbiddenException('No pertenece a ninguna empresa o su usuario está inactivo');
    }

    await this.checkEmpresaActiva(uie[0].empresaId);

    return uie[0].empresaId;
  }

  async checkEmpresaActiva(empresaId: string, executor: DbExecutor = db): Promise<void> {
    await this.getAccesoEmpresa(empresaId, executor);
  }

  async getAccesoEmpresa(empresaId: string, executor: DbExecutor = db) {
    const [emp] = await executor
      .select({ estadoSuscripcion: empresa.estadoSuscripcion, pruebaHasta: empresa.pruebaHasta })
      .from(empresa)
      .where(eq(empresa.id, empresaId));

    if (!emp || emp.estadoSuscripcion !== 'ACTIVO') {
      throw new ForbiddenException('Empresa suspendida');
    }
    const [pago] = emp.pruebaHasta ? await executor.select().from(pagoSuscripcion)
      .where(eq(pagoSuscripcion.empresaId, empresaId))
      .orderBy(desc(pagoSuscripcion.fechaPago), desc(pagoSuscripcion.fechaRegistro)).limit(1) : [];
    const acceso = calcularAccesoEmpresa(emp, pago);
    if (!acceso.permitido) throw new ForbiddenException({
      code: 'ACCESO_EMPRESA_VENCIDO',
      message: 'El periodo de acceso de tu empresa terminó. Comunícate con nosotros para registrar un pago y renovar el acceso.',
    });
    return acceso;
  }

  async getSegundosDescarga(empresaId: string): Promise<number> {
    const acceso = await this.getAccesoEmpresa(empresaId);
    const segundos = acceso.hasta ? Math.floor((acceso.hasta.getTime() - Date.now()) / 1000) : 60;
    if (segundos < 1) throw new ForbiddenException('El periodo de acceso terminó. Comunícate con nosotros para renovarlo.');
    return Math.min(60, segundos);
  }

  /**
   * Verifica contra BD (rol → rol_permiso → permiso) que el usuario tenga el
   * permiso indicado. El rol Administrador tiene acceso total.
   * Devuelve el empresaId del usuario.
   */
  async checkPermiso(userId: string, codigoPermiso: string): Promise<string> {
    const uie = await db
      .select()
      .from(usuarioInternoEmpresa)
      .where(eq(usuarioInternoEmpresa.usuarioId, userId));

    if (!uie.length || !uie[0].estado) {
      throw new ForbiddenException('No pertenece a ninguna empresa o su usuario está inactivo');
    }

    await this.checkEmpresaActiva(uie[0].empresaId);

    const rolResult = await db
      .select({ esInmutable: rol.esInmutable })
      .from(rol)
      .where(eq(rol.id, uie[0].rolId));

    if (rolResult.length && rolResult[0].esInmutable) {
      return uie[0].empresaId;
    }

    const permisos = await db
      .select()
      .from(rolPermiso)
      .innerJoin(permiso, eq(rolPermiso.permisoId, permiso.id))
      .where(and(eq(rolPermiso.rolId, uie[0].rolId), eq(permiso.codigoPermiso, codigoPermiso)));

    if (!permisos.length) {
      throw new ForbiddenException(`Requiere el permiso ${codigoPermiso}`);
    }

    return uie[0].empresaId;
  }

  /**
   * IDs de los usuarios internos **activos** de una empresa que tienen el permiso
   * indicado (o pertenecen al rol Administrador, con bypass). Se usa para elegir
   * los destinatarios de una notificación. Permite excluir a un usuario (p. ej. el
   * autor de la acción, que no debe auto-notificarse).
   */
  async getUsuariosConPermiso(
    empresaId: string,
    codigoPermiso: string,
    excluirUsuarioId?: string,
    executor: DbExecutor = db,
  ): Promise<string[]> {
    const filas = await executor
      .selectDistinct({ usuarioId: usuarioInternoEmpresa.usuarioId })
      .from(usuarioInternoEmpresa)
      .innerJoin(rol, eq(usuarioInternoEmpresa.rolId, rol.id))
      .leftJoin(rolPermiso, eq(rolPermiso.rolId, rol.id))
      .leftJoin(permiso, eq(rolPermiso.permisoId, permiso.id))
      .where(and(
        eq(usuarioInternoEmpresa.empresaId, empresaId),
        eq(usuarioInternoEmpresa.estado, true),
        or(
          eq(rol.esInmutable, true),
          eq(permiso.codigoPermiso, codigoPermiso),
        ),
      ));

    return filas
      .map(f => f.usuarioId)
      .filter(id => id !== excluirUsuarioId);
  }

  /**
   * IDs de los superadmins que pueden gestionar empresas: el principal (bypass
   * total) + los secundarios con `SA_EMPRESA_MANAGE`. Destinatarios de los avisos
   * de suscripción (pago vencido, suspensión, empresa nueva pendiente).
   */
  async getSuperadminsGestionEmpresa(executor: DbExecutor = db): Promise<string[]> {
    const filas = await executor
      .selectDistinct({ id: usuario.id })
      .from(usuario)
      .leftJoin(superadminPermiso, eq(superadminPermiso.usuarioId, usuario.id))
      .where(and(
        eq(usuario.tipoUsuario, 'SUPERADMIN'),
        or(
          eq(usuario.esSuperadminPrincipal, true),
          eq(superadminPermiso.codigoPermiso, 'SA_EMPRESA_MANAGE'),
        ),
      ));
    return filas.map((f) => f.id);
  }

  /** Variante no lanzante, para calcular flags `puede*` de la UI. */
  async tienePermiso(userId: string, codigoPermiso: string): Promise<boolean> {
    try {
      await this.checkPermiso(userId, codigoPermiso);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Lista de códigos de permiso del usuario desde BD (rol → rol_permiso → permiso),
   * para la UI (GET /perfil/permisos). El rol Administrador recibe todos los permisos.
   * No lanza: usuarios sin empresa (contador, superadmin) o inactivos reciben [].
   */
  async getPermisos(userId: string): Promise<string[]> {
    const uie = await db
      .select()
      .from(usuarioInternoEmpresa)
      .where(eq(usuarioInternoEmpresa.usuarioId, userId));

    if (!uie.length || !uie[0].estado) {
      return [];
    }

    try {
      await this.checkEmpresaActiva(uie[0].empresaId);
    } catch {
      return [];
    }

    const rolResult = await db
      .select({ esInmutable: rol.esInmutable })
      .from(rol)
      .where(eq(rol.id, uie[0].rolId));

    if (rolResult.length && rolResult[0].esInmutable) {
      const todos = await db.select({ codigoPermiso: permiso.codigoPermiso }).from(permiso);
      return todos.map(p => p.codigoPermiso);
    }

    const permisos = await db
      .select({ codigoPermiso: permiso.codigoPermiso })
      .from(rolPermiso)
      .innerJoin(permiso, eq(rolPermiso.permisoId, permiso.id))
      .where(eq(rolPermiso.rolId, uie[0].rolId));

    return permisos.map(p => p.codigoPermiso);
  }
}
