import { Injectable, BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { db, usuario, usuarioInternoEmpresa, invitacionContador, relacionEmpresaContador, empresa, factura, documentoSustento, historialFactura, observacion, notificacion, pagoFactura, pagoSuscripcion, rol, rolPermiso, permiso } from '@audivare/database';
import { eq, and, or, sql, desc, ilike, gte, lt, inArray, asc } from 'drizzle-orm';
import { calcularAccesoEmpresa } from '../common/acceso-empresa.util';
import { busquedaListado, patronBusqueda, paginaListado } from '../common/consulta-listado';
import { PermisosService } from '../common/permisos/permisos.service';
import { StorageService } from '../storage/storage.service';
import { NotificacionesService } from '../notificaciones/notificaciones.service';
import { validarEstadoFactura } from '../common/estado-factura.util';

export interface QueryFacturasContador {
  estado?: string;
  proveedor_nombre?: string;
  anio?: string;
  mes?: string;
  busqueda?: string;
  page?: string | number;
  limit?: string | number;
}

/** Rango [desde, hasta) por año (obligatorio) y mes opcional, sobre la fecha de emisión. */
function rangoPorAnioMes(anio?: string, mes?: string): { desde: string; hasta: string } | null {
  if (!anio) return null;
  const y = Number(anio);
  if (!Number.isInteger(y) || y < 2000 || y > 2100) return null;
  if (mes) {
    const m = Number(mes);
    if (!Number.isInteger(m) || m < 1 || m > 12) return null;
    const mm = String(m).padStart(2, '0');
    const hasta = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
    return { desde: `${y}-${mm}-01`, hasta };
  }
  return { desde: `${y}-01-01`, hasta: `${y + 1}-01-01` };
}

@Injectable()
export class ContadoresService {
  constructor(
    private readonly permisosService: PermisosService,
    private readonly storageService: StorageService,
    private readonly notificacionesService: NotificacionesService,
  ) {}

  /**
   * Verifica que el contador esté vinculado a la empresa
   * (relacion_empresa_contador) y que la empresa no esté suspendida.
   */
  private async checkRelacionContador(userId: string, empresaId: string) {
    const relacion = await db
      .select()
      .from(relacionEmpresaContador)
      .where(and(
        eq(relacionEmpresaContador.empresaId, empresaId),
        eq(relacionEmpresaContador.contadorId, userId)
      ));

    if (!relacion.length) {
      throw new ForbiddenException('No estás vinculado a esta empresa');
    }

    await this.permisosService.checkEmpresaActiva(empresaId);
  }

  /**
   * Usuarios internos activos de la empresa que gestionan contadores
   * (rol Administrador —acceso total— o permiso CONTADOR_INVITE):
   * destinatarios de las notificaciones de invitaciones aceptadas/rechazadas.
   */
  private async getDestinatariosNotificacionContador(empresaId: string): Promise<string[]> {
    const vinculos = await db
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
          eq(permiso.codigoPermiso, 'CONTADOR_INVITE'),
        ),
      ));

    return vinculos.map(v => v.usuarioId);
  }

  async invitarContador(userId: string, email: string) {
    const empresaId = await this.permisosService.getEmpresaId(userId);

    return await db.transaction(async (tx) => {
      // Verificar si el usuario ya existe
      let user = await tx.select().from(usuario).where(eq(usuario.email, email));
      let contadorId: string;

      if (user.length === 0) {
        throw new BadRequestException('No existe un usuario registrado en el sistema con ese correo.');
      }

      if (user[0].tipoUsuario === 'INTERNO') {
        throw new BadRequestException('Este email pertenece a un usuario interno y no puede ser contador externo');
      }

      if (user[0].tipoUsuario !== 'CONTADOR_EXTERNO') {
        throw new BadRequestException('El usuario existe pero no es un contador externo.');
      }
      
      contadorId = user[0].id;
      
      // Verificar si ya esta vinculado
      const link = await tx.select().from(relacionEmpresaContador).where(
        and(
          eq(relacionEmpresaContador.empresaId, empresaId),
          eq(relacionEmpresaContador.contadorId, contadorId)
        )
      );

      if (link.length > 0) {
        throw new ConflictException('El contador ya está vinculado a esta empresa');
      }

      // Verificar si ya existe una invitación PENDIENTE
      const pendingInv = await tx.select().from(invitacionContador).where(
        and(
          eq(invitacionContador.empresaId, empresaId),
          eq(invitacionContador.contadorEmail, email),
          eq(invitacionContador.estadoInvitacion, 'PENDIENTE')
        )
      );

      if (pendingInv.length > 0) {
        throw new ConflictException('Ya existe una invitación pendiente para este contador');
      }

      // Obtain empresa info for notification
      const emp = await tx.select().from(empresa).where(eq(empresa.id, empresaId));
      
      // Crear invitacion (estado PENDIENTE)
      const inv = await tx.insert(invitacionContador).values({
        empresaId,
        contadorEmail: email,
        estadoInvitacion: 'PENDIENTE',
      }).returning();

      // Limpiar notificaciones de invitación anteriores no leídas de ESTA empresa
      // a este contador (si se invitó, canceló y reinvitó) para no duplicar tarjetas.
      const previas = await tx.select().from(notificacion).where(and(
        eq(notificacion.usuarioId, contadorId),
        eq(notificacion.tipo, 'INVITACION_EMPRESA'),
        eq(notificacion.leida, false),
      ));
      for (const n of previas) {
        if (n.metadata?.empresa_id === empresaId) {
          await tx.update(notificacion).set({
            leida: true,
            tipo: 'INVITACION_CANCELADA',
            mensaje: `Esta invitación fue reemplazada por una más reciente de ${n.metadata.empresa_nombre || 'la empresa'}.`,
          }).where(eq(notificacion.id, n.id));
        }
      }

      // Crear notificacion
      await this.notificacionesService.crearNotificacion(
        contadorId,
        'INVITACION_EMPRESA',
        'Nueva invitación de empresa',
        `${emp[0].razonSocial} te ha invitado a acceder a su información contable`,
        { empresa_id: empresaId, empresa_nombre: emp[0].razonSocial ?? undefined, invitacion_id: inv[0].id },
        tx,
      );

      return { message: 'Contador invitado exitosamente' };
    });
  }

  async getContadores(userId: string) {
    const empresaId = await this.permisosService.getEmpresaId(userId);

    // Contadores ya vinculados (aceptaron la invitación).
    const vinculados = await db
      .select({
        id: usuario.id,
        nombre_completo: usuario.nombreCompleto,
        email: usuario.email,
        fecha_vinculacion: relacionEmpresaContador.fechaVinculacion,
      })
      .from(relacionEmpresaContador)
      .innerJoin(usuario, eq(relacionEmpresaContador.contadorId, usuario.id))
      .where(eq(relacionEmpresaContador.empresaId, empresaId));

    // Invitaciones enviadas que aún no se aceptan (el contador ya existe en el
    // sistema porque invitar exige que tenga cuenta).
    const pendientes = await db
      .select({
        id: usuario.id,
        nombre_completo: usuario.nombreCompleto,
        email: invitacionContador.contadorEmail,
        fecha_vinculacion: invitacionContador.fechaEnvio,
      })
      .from(invitacionContador)
      .leftJoin(usuario, eq(usuario.email, invitacionContador.contadorEmail))
      .where(and(
        eq(invitacionContador.empresaId, empresaId),
        eq(invitacionContador.estadoInvitacion, 'PENDIENTE'),
      ));

    const data = [
      ...vinculados.map((v) => ({ ...v, estado: 'VINCULADO' as const })),
      ...pendientes.map((p) => ({ ...p, estado: 'PENDIENTE' as const })),
    ];

    return { data };
  }

  async desvincularContador(userId: string, contadorId: string) {
    const empresaId = await this.permisosService.getEmpresaId(userId);

    return await db.transaction(async (tx) => {
      // ¿Estaba realmente vinculado, o solo era una invitación pendiente?
      const relBorradas = await tx.delete(relacionEmpresaContador)
        .where(and(
          eq(relacionEmpresaContador.empresaId, empresaId),
          eq(relacionEmpresaContador.contadorId, contadorId)
        ))
        .returning({ id: relacionEmpresaContador.contadorId });
      const eraVinculado = relBorradas.length > 0;

      const cont = await tx.select().from(usuario).where(eq(usuario.id, contadorId));
      if (cont.length > 0) {
        // Revocar las invitaciones pendientes de esta empresa a ese correo.
        await tx.update(invitacionContador)
          .set({ estadoInvitacion: 'REVOCADA' })
          .where(and(
            eq(invitacionContador.empresaId, empresaId),
            eq(invitacionContador.contadorEmail, cont[0].email),
            eq(invitacionContador.estadoInvitacion, 'PENDIENTE'),
          ));

        // Marcar como leídas las notificaciones de invitación de esta empresa
        // (así desaparecen las tarjetas de "invitación pendiente" del contador).
        const notifs = await tx.select().from(notificacion).where(and(
          eq(notificacion.usuarioId, contadorId),
          eq(notificacion.tipo, 'INVITACION_EMPRESA'),
          eq(notificacion.leida, false),
        ));
        for (const n of notifs) {
          if (n.metadata?.empresa_id === empresaId) {
            await tx.update(notificacion).set({
              leida: true,
              tipo: 'INVITACION_CANCELADA',
              mensaje: `${n.metadata.empresa_nombre || 'La empresa'} canceló esta invitación.`,
            }).where(eq(notificacion.id, n.id));
          }
        }
      }

      // Solo se avisa "removido de la empresa" si de verdad estaba vinculado;
      // cancelar una invitación pendiente no dispara ese aviso.
      if (eraVinculado) {
        const emp = await tx.select().from(empresa).where(eq(empresa.id, empresaId));
        await this.notificacionesService.crearNotificacion(
          contadorId,
          'REMOVIDO_EMPRESA',
          'Has sido removido de una empresa',
          `${emp[0].razonSocial} ha revocado tu acceso a su información contable`,
          { empresa_id: empresaId, empresa_nombre: emp[0].razonSocial ?? undefined },
          tx,
        );
      }

      return { message: eraVinculado ? 'Contador desvinculado exitosamente' : 'Invitación cancelada' };
    });
  }

  async aceptarInvitacion(userId: string, tipoUsuario: string, invitacionId: string) {
    if (tipoUsuario !== 'CONTADOR_EXTERNO') {
      throw new ForbiddenException('Solo contadores externos pueden aceptar invitaciones');
    }

    return await db.transaction(async (tx) => {
      const inv = await tx.select().from(invitacionContador).where(eq(invitacionContador.id, invitacionId));
      if (!inv.length) throw new NotFoundException('Invitación no encontrada');
      if (inv[0].estadoInvitacion !== 'PENDIENTE') throw new BadRequestException('La invitación no está pendiente');

      const user = await tx.select().from(usuario).where(eq(usuario.id, userId));
      if (user[0].email !== inv[0].contadorEmail) throw new ForbiddenException('La invitación no pertenece a tu usuario');

      await tx.update(invitacionContador).set({ estadoInvitacion: 'ACEPTADA' }).where(eq(invitacionContador.id, invitacionId));

      await tx.insert(relacionEmpresaContador).values({
        empresaId: inv[0].empresaId,
        contadorId: userId,
      });

      const notifs = await tx.select().from(notificacion).where(and(eq(notificacion.usuarioId, userId), eq(notificacion.tipo, 'INVITACION_EMPRESA')));
      for (const n of notifs) {
        if (n.metadata && n.metadata.invitacion_id === invitacionId) {
          await tx.update(notificacion)
            .set({
              leida: true,
              tipo: 'INVITACION_ACEPTADA',
              mensaje: `Aceptaste la invitación de ${n.metadata.empresa_nombre || 'la empresa'}.`
            })
            .where(eq(notificacion.id, n.id));
        } else if (!n.leida && n.metadata?.empresa_id === inv[0].empresaId) {
          // Tarjetas duplicadas de invitaciones anteriores de la misma empresa: se limpian.
          await tx.update(notificacion).set({
            leida: true,
            tipo: 'INVITACION_CANCELADA',
            mensaje: 'Esta invitación ya no está disponible.',
          }).where(eq(notificacion.id, n.id));
        }
      }

      const emp = await tx.select().from(empresa).where(eq(empresa.id, inv[0].empresaId));

      const destinatarios = await this.getDestinatariosNotificacionContador(inv[0].empresaId);
      for (const destinatarioId of destinatarios) {
        await this.notificacionesService.crearNotificacion(
          destinatarioId,
          'INVITACION_ACEPTADA',
          'Invitación aceptada',
          `El contador ${user[0].nombreCompleto || user[0].email} ha aceptado la invitación a tu empresa.`,
          { contador_id: userId, contador_email: user[0].email },
          tx,
        );
      }

      return {
        mensaje: `Invitación aceptada. Ahora tienes acceso a ${emp[0].razonSocial}`,
        empresa: {
          id: emp[0].id,
          razon_social: emp[0].razonSocial,
          ruc: emp[0].ruc,
        }
      };
    });
  }

  async rechazarInvitacion(userId: string, tipoUsuario: string, invitacionId: string) {
    if (tipoUsuario !== 'CONTADOR_EXTERNO') {
      throw new ForbiddenException('Solo contadores externos pueden rechazar invitaciones');
    }

    return await db.transaction(async (tx) => {
      const inv = await tx.select().from(invitacionContador).where(eq(invitacionContador.id, invitacionId));
      if (!inv.length) throw new NotFoundException('Invitación no encontrada');
      if (inv[0].estadoInvitacion !== 'PENDIENTE') throw new BadRequestException('La invitación no está pendiente');

      const user = await tx.select().from(usuario).where(eq(usuario.id, userId));
      if (user[0].email !== inv[0].contadorEmail) throw new ForbiddenException('La invitación no pertenece a tu usuario');

      await tx.update(invitacionContador).set({ estadoInvitacion: 'RECHAZADA' }).where(eq(invitacionContador.id, invitacionId));

      const notifs = await tx.select().from(notificacion).where(and(eq(notificacion.usuarioId, userId), eq(notificacion.tipo, 'INVITACION_EMPRESA')));
      for (const n of notifs) {
        if (n.metadata && n.metadata.invitacion_id === invitacionId) {
          await tx.update(notificacion)
            .set({
              leida: true,
              tipo: 'INVITACION_RECHAZADA',
              mensaje: `Rechazaste la invitación de ${n.metadata.empresa_nombre || 'la empresa'}.`
            })
            .where(eq(notificacion.id, n.id));
        } else if (!n.leida && n.metadata?.empresa_id === inv[0].empresaId) {
          // Tarjetas duplicadas de invitaciones anteriores de la misma empresa: se limpian.
          await tx.update(notificacion).set({
            leida: true,
            tipo: 'INVITACION_CANCELADA',
            mensaje: 'Esta invitación ya no está disponible.',
          }).where(eq(notificacion.id, n.id));
        }
      }
      const destinatarios = await this.getDestinatariosNotificacionContador(inv[0].empresaId);
      for (const destinatarioId of destinatarios) {
        await this.notificacionesService.crearNotificacion(
          destinatarioId,
          'INVITACION_RECHAZADA',
          'Invitación rechazada',
          `El contador ${user[0].nombreCompleto || user[0].email} ha rechazado la invitación a tu empresa.`,
          { contador_id: userId, contador_email: user[0].email },
          tx,
        );
      }

      return { mensaje: 'Invitación rechazada' };
    });
  }

  async getDetalleEmpresa(userId: string, tipoUsuario: string, empresaId: string) {
    if (tipoUsuario !== 'CONTADOR_EXTERNO') throw new ForbiddenException('Solo contadores externos pueden acceder a esta ruta');
    await this.checkRelacionContador(userId, empresaId);
    const [detalle] = await db.select({ id: empresa.id, razon_social: empresa.razonSocial, ruc: empresa.ruc })
      .from(empresa).where(eq(empresa.id, empresaId));
    if (!detalle) throw new NotFoundException('Empresa no disponible');
    return detalle;
  }

  async getMisEmpresas(userId: string, tipoUsuario: string, consulta: { busqueda?: unknown; pagina?: unknown } = {}) {
    if (tipoUsuario !== 'CONTADOR_EXTERNO') {
      throw new ForbiddenException('Solo contadores externos pueden acceder a esta ruta');
    }

    const pagina = paginaListado(consulta.pagina), busqueda = busquedaListado(consulta.busqueda);
    const filtros = [eq(relacionEmpresaContador.contadorId, userId), eq(empresa.estadoSuscripcion, 'ACTIVO')];
    if (busqueda) filtros.push(or(ilike(empresa.ruc, patronBusqueda(busqueda)), ilike(empresa.razonSocial, patronBusqueda(busqueda)))!);
    // Solo IDs/vigencia para autorizar; no cargar tarjetas ni hacer una consulta por empresa.
    const candidatas = await db
      .select({ id: empresa.id, pruebaHasta: empresa.pruebaHasta })
      .from(relacionEmpresaContador)
      .innerJoin(empresa, eq(relacionEmpresaContador.empresaId, empresa.id))
      .where(and(...filtros));
    const conPrueba = candidatas.filter(e => e.pruebaHasta).map(e => e.id);
    const pagos = conPrueba.length ? await db.selectDistinctOn([pagoSuscripcion.empresaId], {
      empresaId: pagoSuscripcion.empresaId, fechaPago: pagoSuscripcion.fechaPago, duracionMeses: pagoSuscripcion.duracionMeses,
    }).from(pagoSuscripcion).where(inArray(pagoSuscripcion.empresaId, conPrueba))
      .orderBy(pagoSuscripcion.empresaId, desc(pagoSuscripcion.fechaPago), desc(pagoSuscripcion.fechaRegistro)) : [];
    const porEmpresa = new Map(pagos.map(p => [p.empresaId, p]));
    const ahora = new Date();
    const permitidas = candidatas.filter(e => calcularAccesoEmpresa({ estadoSuscripcion: 'ACTIVO', pruebaHasta: e.pruebaHasta }, porEmpresa.get(e.id), ahora).permitido).map(e => e.id);
    const data = permitidas.length ? await db.select({
      id: empresa.id, razon_social: empresa.razonSocial, ruc: empresa.ruc,
      fecha_vinculacion: relacionEmpresaContador.fechaVinculacion,
    }).from(relacionEmpresaContador).innerJoin(empresa, eq(relacionEmpresaContador.empresaId, empresa.id))
      .where(and(eq(relacionEmpresaContador.contadorId, userId), inArray(empresa.id, permitidas)))
      .orderBy(asc(empresa.razonSocial), asc(empresa.id)).limit(10).offset((pagina - 1) * 10) : [];
    return { data, total: permitidas.length, pagina, porPagina: 10 };
  }

  async getFacturasDeEmpresa(userId: string, tipoUsuario: string, empresaId: string, query: QueryFacturasContador) {
    if (tipoUsuario !== 'CONTADOR_EXTERNO') {
      throw new ForbiddenException('Solo contadores externos pueden acceder a esta ruta');
    }

    await this.checkRelacionContador(userId, empresaId);

    // Listar facturas
    const { estado, proveedor_nombre, anio, mes, busqueda, page = 1, limit = 10 } = query;
    const pageNum = Number(page);
    const limitNum = Number(limit);
    const offset = (pageNum - 1) * limitNum;

    const filters = [eq(factura.empresaId, empresaId)];
    if (estado) filters.push(eq(factura.estadoFactura, validarEstadoFactura(estado)));
    // Búsqueda por serie-número (serie, número o la combinación "serie-número")
    if (busqueda && busqueda.trim()) {
      const term = `%${busqueda.trim()}%`;
      const busquedaCondition = or(
        ilike(factura.serie, term),
        ilike(factura.numero, term),
        sql`${factura.serie} || '-' || ${factura.numero} ILIKE ${term}`,
      );
      if (busquedaCondition) filters.push(busquedaCondition);
    }
    if (proveedor_nombre) {
      const proveedorCondition = or(
        ilike(factura.proveedorNombre, `%${proveedor_nombre}%`),
        ilike(factura.proveedorRuc, `%${proveedor_nombre}%`)
      );
      if (proveedorCondition) filters.push(proveedorCondition);
    }
    const rango = rangoPorAnioMes(anio, mes);
    if (rango) {
      filters.push(gte(factura.fechaEmision, rango.desde));
      filters.push(lt(factura.fechaEmision, rango.hasta));
    }

    const result = await db.select({
      id: factura.id,
      serie: factura.serie,
      numero: factura.numero,
      moneda: factura.moneda,
      monto_total: factura.montoTotal,
      saldo_pendiente: factura.saldoPendiente,
      fecha_emision: factura.fechaEmision,
      estado: factura.estadoFactura,
      documentacion_estado: factura.documentacionEstado,
      proveedor_ruc: factura.proveedorRuc,
      proveedor_razon_social: factura.proveedorNombre,
    })
    .from(factura)
    .where(and(...filters))
    .limit(limitNum)
    .offset(offset)
    // Mismo criterio que el listado interno: fecha de emisión (más reciente
    // primero) con el id como desempate para un paginado estable por offset.
    .orderBy(desc(factura.fechaEmision), desc(factura.id));

    const totalRes = await db.select({ count: sql<number>`count(*)` })
    .from(factura)
    .where(and(...filters));

    return {
      data: result,
      meta: {
        total: Number(totalRes[0].count),
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(Number(totalRes[0].count) / limitNum)
      }
    };
  }

  async getFacturaDetalle(userId: string, tipoUsuario: string, empresaId: string, facturaId: string) {
    if (tipoUsuario !== 'CONTADOR_EXTERNO') {
      throw new ForbiddenException('Solo contadores externos pueden acceder a esta ruta');
    }

    await this.checkRelacionContador(userId, empresaId);

    const facturasList = await db
      .select({
        id: factura.id,
        tipoComprobante: factura.tipoComprobante,
        baseImponible: factura.baseImponible,
        igv: factura.igv,
        fechaActualizacion: factura.fechaActualizacion,
        serie: factura.serie,
        numero: factura.numero,
        proveedorNombre: factura.proveedorNombre,
        proveedorRuc: factura.proveedorRuc,
        receptorRuc: factura.receptorRuc,
        receptorRazonSocial: factura.receptorRazonSocial,
        moneda: factura.moneda,
        montoTotal: factura.montoTotal,
        saldoPendiente: factura.saldoPendiente,
        fechaEmision: factura.fechaEmision,
        estado_factura: factura.estadoFactura,
        documentacion_estado: factura.documentacionEstado,
        fechaCreacion: factura.fechaCreacion,
      })
      .from(factura)
      .where(and(eq(factura.id, facturaId), eq(factura.empresaId, empresaId)));

    if (!facturasList.length) {
      throw new NotFoundException('Factura no encontrada en esta empresa');
    }

    const facturaData = facturasList[0];

    const documentosSustentoList = await db
      .select()
      .from(documentoSustento)
      .where(eq(documentoSustento.facturaId, facturaId));

    // Historial de eventos de la factura (mismo que ve la empresa): al tener
    // paridad de escritura, el contador ve qué pasó (cargas, pagos, marcados).
    const historial = await db
      .select()
      .from(historialFactura)
      .where(eq(historialFactura.facturaId, facturaId))
      .orderBy(desc(historialFactura.fechaEvento));

    // El contador externo solo ve SUS PROPIAS observaciones externas: nunca las
    // internas de la empresa ni las externas de otros contadores de la empresa.
    const observacionesList = await db
      .select({
        id: observacion.id,
        contenido: observacion.contenido,
        tipo: observacion.tipo,
        creadoPor: observacion.creadoPor,
        atendida: observacion.atendida,
        respuesta: observacion.respuesta,
        fechaCreacion: observacion.fechaCreacion,
        fechaAtencion: observacion.fechaAtencion,
        usuarioNombre: usuario.nombreCompleto,
      })
      .from(observacion)
      .leftJoin(usuario, eq(usuario.id, observacion.creadoPor))
      .where(and(
        eq(observacion.facturaId, facturaId),
        eq(observacion.tipo, 'EXTERNA'),
        eq(observacion.creadoPor, userId),
      ))
      .orderBy(desc(observacion.fechaCreacion));

    const observacionesListMapped = observacionesList.map(obs => ({
      ...obs,
      usuarioNombre: [{ nombre: obs.usuarioNombre || 'Usuario Desconocido' }]
    }));

    const pagosList = await db
      .select()
      .from(pagoFactura)
      .where(eq(pagoFactura.facturaId, facturaId))
      .orderBy(desc(pagoFactura.fechaRegistro));

    const pagos = await Promise.all(pagosList.map(async (pago) => ({
      ...pago,
      comprobanteUrl: pago.comprobantePath
        ? await this.storageService.getPresignedUrl(pago.comprobantePath, await this.permisosService.getSegundosDescarga(empresaId))
        : null,
    })));

    return {
      factura: facturaData,
      documentos: documentosSustentoList,
      historial,
      observaciones: observacionesListMapped,
      pagos,
    };
  }
  async crearObservacionExterna(userId: string, tipoUsuario: string, empresaId: string, facturaId: string, contenido: string) {
    if (tipoUsuario !== 'CONTADOR_EXTERNO') {
      throw new ForbiddenException('Solo contadores externos pueden acceder a esta ruta');
    }

    await this.checkRelacionContador(userId, empresaId);

    const facturasList = await db
      .select()
      .from(factura)
      .where(and(eq(factura.id, facturaId), eq(factura.empresaId, empresaId)));

    if (!facturasList.length) {
      throw new NotFoundException('Factura no encontrada en esta empresa');
    }

    const facturaData = facturasList[0];
    // Destinatarios: internos activos que pueden leer observaciones (o Administrador).
    const destinatarios = await this.permisosService.getUsuariosConPermiso(empresaId, 'OBSERVACION_READ');
    const resumen = contenido.trim().length > 120 ? `${contenido.trim().slice(0, 119)}…` : contenido.trim();

    return await db.transaction(async (tx) => {
      const inserted = await tx.insert(observacion).values({
        facturaId,
        tipo: 'EXTERNA',
        creadoPor: userId,
        contenido,
      }).returning();

      await tx.insert(historialFactura).values({
        facturaId,
        usuarioId: userId,
        evento: 'Solicitud del contador',
        detalle: contenido,
      });

      for (const destinatarioId of destinatarios) {
        await this.notificacionesService.crearNotificacion(
          destinatarioId,
          'OBSERVACION_CREADA',
          'Nueva solicitud del contador',
          `El contador solicita algo en la factura ${facturaData.serie}-${facturaData.numero}: ${resumen}`,
          {
            factura_id: facturaId,
            factura_serie: facturaData.serie ?? undefined,
            factura_numero: facturaData.numero ?? undefined,
            observacion_id: inserted[0].id,
          },
          tx,
        );
      }

      return {
        id: inserted[0].id,
        mensaje: 'Solicitud enviada a la empresa exitosamente',
      };
    });
  }

  async getDownloadUrlContador(userId: string, tipoUsuario: string, empresaId: string, facturaId: string, documentoId: string) {
    if (tipoUsuario !== 'CONTADOR_EXTERNO') {
      throw new ForbiddenException('Solo contadores externos pueden acceder a esta ruta');
    }

    await this.checkRelacionContador(userId, empresaId);

    const facturasList = await db
      .select()
      .from(factura)
      .where(and(eq(factura.id, facturaId), eq(factura.empresaId, empresaId)));

    if (!facturasList.length) {
      throw new NotFoundException('Factura no encontrada en esta empresa');
    }

    const docs = await db
      .select()
      .from(documentoSustento)
      .where(and(eq(documentoSustento.id, documentoId), eq(documentoSustento.facturaId, facturaId)));

    if (!docs.length) {
      throw new NotFoundException('Documento no encontrado');
    }

    const url = await this.storageService.getPresignedUrl(docs[0].archivoStoragePath, await this.permisosService.getSegundosDescarga(empresaId));
    return { url };
  }
}
