import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { db, empresa, pagoSuscripcion, factura, usuario, usuarioInternoEmpresa, rol, superadminPermiso, documentoSustento, pagoFactura, documentoEmpresa, observacion, historialFactura, relacionEmpresaContador, documentoMensual } from '@audivare/database';
import { eq, count, inArray, sql, desc, and, isNull } from 'drizzle-orm';
import { calcularAccesoEmpresa } from '../common/acceso-empresa.util';
import { NotificacionesService } from '../notificaciones/notificaciones.service';
import { PermisosService } from '../common/permisos/permisos.service';
import { StorageService } from '../storage/storage.service';
import { validarEmailConDominio } from '../common/email.util';
import { SA_PERMISOS, CODIGOS_SA } from './sa-permisos';
import { SuscripcionesService } from './suscripciones.service';

@Injectable()
export class SuperadminService {
  constructor(
    private readonly notificacionesService: NotificacionesService,
    private readonly permisosService: PermisosService,
    private readonly suscripcionesService: SuscripcionesService,
    private readonly storageService: StorageService,
  ) {}

  /**
   * Elimina una empresa por completo (cascade borra facturas, documentos, pagos,
   * roles, vínculos de usuarios internos, relación con contadores, etc.). Los
   * usuarios internos quedan como cuentas huérfanas (el sistema ya lo maneja). Se
   * limpian los archivos de MinIO aparte porque el cascade no los toca.
   */
  async eliminarEmpresa(empresaId: string) {
    const [mensual] = await db.select({ id: documentoMensual.id }).from(documentoMensual).where(eq(documentoMensual.empresaId, empresaId)).limit(1);
    if (mensual) throw new BadRequestException('Esta empresa tiene documentos o actividad mensual. Suspende su acceso y coordina el cierre y conservación antes de eliminarla.');
    const e = await db.select({ razonSocial: empresa.razonSocial }).from(empresa).where(eq(empresa.id, empresaId));
    if (!e.length) {
      throw new NotFoundException('Empresa no encontrada');
    }

    // Recolectar rutas de archivos en MinIO antes de borrar la BD.
    const paths: string[] = [];
    const facturas = await db.select({ id: factura.id }).from(factura).where(eq(factura.empresaId, empresaId));
    const facturaIds = facturas.map((f) => f.id);
    if (facturaIds.length) {
      const docs = await db.select({ p: documentoSustento.archivoStoragePath }).from(documentoSustento).where(inArray(documentoSustento.facturaId, facturaIds));
      docs.forEach((d) => d.p && paths.push(d.p));
      const pagos = await db.select({ p: pagoFactura.comprobantePath }).from(pagoFactura).where(inArray(pagoFactura.facturaId, facturaIds));
      pagos.forEach((p) => p.p && paths.push(p.p));
    }
    const docsEmp = await db.select({ p: documentoEmpresa.archivoStoragePath }).from(documentoEmpresa).where(eq(documentoEmpresa.empresaId, empresaId));
    docsEmp.forEach((d) => d.p && paths.push(d.p));

    // Borrado en BD (cascade). Luego limpieza de MinIO best-effort.
    await db.delete(empresa).where(eq(empresa.id, empresaId));
    for (const p of paths) {
      try {
        await this.storageService.deleteFile(p);
      } catch {
        // Si falla deja un huérfano recuperable; no bloquea la operación.
      }
    }

    return { message: `Empresa "${e[0].razonSocial}" eliminada` };
  }

  /** Lista los contadores externos de la plataforma con su número de empresas vinculadas. */
  async getContadores() {
    const contadores = await db
      .select({
        id: usuario.id,
        nombre_completo: usuario.nombreCompleto,
        email: usuario.email,
        fecha_registro: usuario.fechaRegistro,
        empresas_vinculadas: sql<number>`count(${relacionEmpresaContador.contadorId})`,
      })
      .from(usuario)
      .leftJoin(relacionEmpresaContador, eq(relacionEmpresaContador.contadorId, usuario.id))
      .where(eq(usuario.tipoUsuario, 'CONTADOR_EXTERNO'))
      .groupBy(usuario.id)
      .orderBy(usuario.nombreCompleto);

    return { data: contadores.map((c) => ({ ...c, empresas_vinculadas: Number(c.empresas_vinculadas) })) };
  }

  /**
   * Elimina un contador externo. Como su trabajo está referenciado en registros de
   * las empresas (facturas que importó, historial, pagos), primero se anula la
   * atribución (se conservan los registros, mostrando "usuario eliminado") y se
   * borran sus observaciones (autor obligatorio); luego se elimina la cuenta.
   * Vínculos, notificaciones y `subido_por` de documentos se resuelven por cascade/set null.
   */
  async eliminarContador(contadorId: string) {
    const u = await db.select({ email: usuario.email, tipo: usuario.tipoUsuario }).from(usuario).where(eq(usuario.id, contadorId));
    if (!u.length) {
      throw new NotFoundException('Contador no encontrado');
    }
    if (u[0].tipo !== 'CONTADOR_EXTERNO') {
      throw new BadRequestException('El usuario no es un contador externo');
    }

    await db.transaction(async (tx) => {
      await tx.update(factura).set({ creadoPor: null }).where(eq(factura.creadoPor, contadorId));
      await tx.update(factura).set({ documentacionCompletadaPor: null }).where(eq(factura.documentacionCompletadaPor, contadorId));
      await tx.update(historialFactura).set({ usuarioId: null }).where(eq(historialFactura.usuarioId, contadorId));
      await tx.update(pagoFactura).set({ registradoPor: null }).where(eq(pagoFactura.registradoPor, contadorId));
      await tx.delete(observacion).where(eq(observacion.creadoPor, contadorId));
      await tx.delete(usuario).where(eq(usuario.id, contadorId));
    });

    return { message: `Contador "${u[0].email}" eliminado` };
  }

  async getEmpresas() {
    const empresas = await db
      .select({
        id: empresa.id,
        email_registro: empresa.emailRegistro,
        ruc: empresa.ruc,
        razon_social: empresa.razonSocial,
        plan_suscripcion: empresa.planSuscripcion,
        estado_suscripcion: empresa.estadoSuscripcion,
        limite_usuarios: empresa.limiteUsuarios,
        fecha_creacion: empresa.fechaCreacion,
        suspendida_por_pago: empresa.suspendidaPorPago,
        prueba_hasta: empresa.pruebaHasta,
      })
      .from(empresa);

    const data = await Promise.all(
      empresas.map(async (e) => {
        const dCount = await db
          .select({ c: count() })
          .from(documentoMensual)
          .where(and(eq(documentoMensual.empresaId, e.id), isNull(documentoMensual.eliminadoEn)));

        const uCount = await db
          .select({ c: count() })
          .from(usuarioInternoEmpresa)
          .where(eq(usuarioInternoEmpresa.empresaId, e.id));

        return {
          ...e,
          total_documentos: dCount[0].c,
          total_usuarios: uCount[0].c,
          ciclo_pago: await this.suscripcionesService.getCiclo(e.id, e.fecha_creacion, e.prueba_hasta),
        };
      })
    );

    return {
      data,
      total: data.length,
    };
  }

  async updateEstadoEmpresa(id: string, estado_suscripcion: 'ACTIVO' | 'SUSPENDIDO') {
    if (estado_suscripcion !== 'ACTIVO' && estado_suscripcion !== 'SUSPENDIDO') {
      throw new BadRequestException('estado_suscripcion inválido');
    }

    const e = await db
      .select()
      .from(empresa)
      .where(eq(empresa.id, id));

    if (e.length === 0) {
      throw new NotFoundException('Empresa no encontrada');
    }

    if (estado_suscripcion === 'ACTIVO' && e[0].pruebaHasta) {
      const [pago] = await db.select().from(pagoSuscripcion).where(eq(pagoSuscripcion.empresaId, id))
        .orderBy(desc(pagoSuscripcion.fechaPago), desc(pagoSuscripcion.fechaRegistro)).limit(1);
      if (!calcularAccesoEmpresa({ ...e[0], estadoSuscripcion: 'ACTIVO' }, pago).permitido) {
        throw new BadRequestException('Registra un periodo vigente para reactivar la empresa; puedes usar monto cero si concederás acceso sin cobro.');
      }
    }

    // El cambio manual de estado limpia la marca de suspensión automática:
    // una suspensión manual no debe revertirse sola al registrar un pago.
    await db
      .update(empresa)
      .set({ estadoSuscripcion: estado_suscripcion, suspendidaPorPago: false })
      .where(eq(empresa.id, id));

    return {
      id,
      estado_suscripcion,
      mensaje: 'Estado actualizado',
    };
  }

  // ---- Gestión de superadmins secundarios ----

  /** Permisos de plataforma del superadmin autenticado, para gatear la UI. */
  async getMisPermisos(userId: string) {
    const u = await db
      .select({ esPrincipal: usuario.esSuperadminPrincipal })
      .from(usuario)
      .where(eq(usuario.id, userId));

    if (u.length && u[0].esPrincipal) {
      return { es_principal: true, permisos: CODIGOS_SA };
    }

    const filas = await db
      .select({ codigo: superadminPermiso.codigoPermiso })
      .from(superadminPermiso)
      .where(eq(superadminPermiso.usuarioId, userId));

    return { es_principal: false, permisos: filas.map((f) => f.codigo) };
  }

  getPermisosDisponibles() {
    return { data: SA_PERMISOS };
  }

  async getAdmins() {
    const admins = await db
      .select({
        id: usuario.id,
        email: usuario.email,
        nombre_completo: usuario.nombreCompleto,
        es_principal: usuario.esSuperadminPrincipal,
        fecha_registro: usuario.fechaRegistro,
      })
      .from(usuario)
      .where(eq(usuario.tipoUsuario, 'SUPERADMIN'));

    const data = await Promise.all(
      admins.map(async (a) => {
        if (a.es_principal) {
          return { ...a, permisos: CODIGOS_SA };
        }
        const filas = await db
          .select({ codigo: superadminPermiso.codigoPermiso })
          .from(superadminPermiso)
          .where(eq(superadminPermiso.usuarioId, a.id));
        return { ...a, permisos: filas.map((f) => f.codigo) };
      })
    );

    return { data, total: data.length };
  }

  private validarCodigosPermisos(permisos: string[]) {
    const invalidos = permisos.filter((p) => !CODIGOS_SA.includes(p));
    if (invalidos.length > 0) {
      throw new BadRequestException(`Permisos inválidos: ${invalidos.join(', ')}`);
    }
  }

  /** Crea un superadmin secundario. Ingresa con su cuenta de Google; el nombre se completa al primer login. */
  async crearAdmin(emailCrudo: string, permisos: string[]) {
    const email = await validarEmailConDominio(emailCrudo);
    this.validarCodigosPermisos(permisos);

    const existe = await db.select().from(usuario).where(eq(usuario.email, email));
    if (existe.length > 0) {
      throw new BadRequestException('El email ya está registrado en la plataforma');
    }

    return await db.transaction(async (tx) => {
      const [nuevo] = await tx.insert(usuario).values({
        email,
        tipoUsuario: 'SUPERADMIN',
      }).returning({ id: usuario.id });

      if (permisos.length > 0) {
        await tx.insert(superadminPermiso).values(
          permisos.map((codigo) => ({ usuarioId: nuevo.id, codigoPermiso: codigo }))
        );
      }

      return { id: nuevo.id, email, permisos, message: 'Administrador creado. Ya puede ingresar con su cuenta de Google.' };
    });
  }

  private async getAdminSecundario(adminId: string) {
    const u = await db.select().from(usuario).where(eq(usuario.id, adminId));
    if (!u.length || u[0].tipoUsuario !== 'SUPERADMIN') {
      throw new NotFoundException('Administrador no encontrado');
    }
    if (u[0].esSuperadminPrincipal) {
      throw new ForbiddenException('El superadmin principal no puede modificarse ni eliminarse');
    }
    return u[0];
  }

  async updatePermisosAdmin(adminId: string, permisos: string[]) {
    this.validarCodigosPermisos(permisos);
    await this.getAdminSecundario(adminId);

    await db.transaction(async (tx) => {
      await tx.delete(superadminPermiso).where(eq(superadminPermiso.usuarioId, adminId));
      if (permisos.length > 0) {
        await tx.insert(superadminPermiso).values(
          permisos.map((codigo) => ({ usuarioId: adminId, codigoPermiso: codigo }))
        );
      }
    });

    return { id: adminId, permisos, message: 'Permisos actualizados' };
  }

  async eliminarAdmin(actorId: string, adminId: string) {
    if (actorId === adminId) {
      throw new BadRequestException('No puedes eliminarte a ti mismo');
    }
    await this.getAdminSecundario(adminId);

    // El cascade elimina sus permisos y notificaciones
    await db.delete(usuario).where(eq(usuario.id, adminId));

    return { message: 'Administrador eliminado' };
  }

  async updateLimiteUsuarios(id: string, limiteUsuarios: number) {
    if (!Number.isInteger(limiteUsuarios) || limiteUsuarios < 1) {
      throw new BadRequestException('limite_usuarios debe ser un entero mayor o igual a 1');
    }

    const e = await db.select({ razonSocial: empresa.razonSocial }).from(empresa).where(eq(empresa.id, id));
    if (e.length === 0) {
      throw new NotFoundException('Empresa no encontrada');
    }

    return await db.transaction(async (tx) => {
      await tx.update(empresa).set({ limiteUsuarios }).where(eq(empresa.id, id));

      // Si el nuevo límite queda por debajo del uso actual, se desactivan los
      // últimos usuarios registrados (nunca el Administrador) hasta cumplirlo.
      const vinculos = await tx
        .select({
          usuarioId: usuarioInternoEmpresa.usuarioId,
          estado: usuarioInternoEmpresa.estado,
          esInmutable: rol.esInmutable,
          email: usuario.email,
          nombre: usuario.nombreCompleto,
          fechaRegistro: usuario.fechaRegistro,
        })
        .from(usuarioInternoEmpresa)
        .innerJoin(usuario, eq(usuarioInternoEmpresa.usuarioId, usuario.id))
        .innerJoin(rol, eq(usuarioInternoEmpresa.rolId, rol.id))
        .where(eq(usuarioInternoEmpresa.empresaId, id));

      const exceso = vinculos.length - limiteUsuarios;
      let desactivados: typeof vinculos = [];

      if (exceso > 0) {
        desactivados = vinculos
          .filter((v) => v.estado && !v.esInmutable)
          .sort((a, b) => (b.fechaRegistro?.getTime() ?? 0) - (a.fechaRegistro?.getTime() ?? 0))
          .slice(0, exceso);

        if (desactivados.length > 0) {
          await tx
            .update(usuarioInternoEmpresa)
            .set({ estado: false })
            .where(inArray(usuarioInternoEmpresa.usuarioId, desactivados.map((d) => d.usuarioId)));

          // Avisar a quienes gestionan usuarios en la empresa (sin incluir a los desactivados)
          const idsDesactivados = new Set(desactivados.map((d) => d.usuarioId));
          const destinatarios = (await this.permisosService.getUsuariosConPermiso(id, 'USUARIO_MANAGE'))
            .filter((uid) => !idsDesactivados.has(uid));

          const listado = desactivados.map((d) => d.nombre || d.email).join(', ');
          for (const destinatario of destinatarios) {
            await this.notificacionesService.crearNotificacion(
              destinatario,
              'LIMITE_USUARIOS_REDUCIDO',
              'Límite de usuarios reducido',
              `El administrador de la plataforma estableció el límite de usuarios de tu empresa en ${limiteUsuarios}. Se desactivó automáticamente a: ${listado}.`.slice(0, 500),
              {
                empresa_id: id,
                limite_usuarios: limiteUsuarios,
                usuarios_desactivados: desactivados.map((d) => d.email),
              },
              tx,
            );
          }
        }
      }

      return {
        id,
        limite_usuarios: limiteUsuarios,
        usuarios_desactivados: desactivados.map((d) => d.email),
        mensaje: desactivados.length > 0
          ? `Límite actualizado; se desactivó a ${desactivados.length} usuario(s)`
          : 'Límite de usuarios actualizado',
      };
    });
  }
}
