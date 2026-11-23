import { Injectable, ForbiddenException, NotFoundException, BadRequestException, ConflictException, Logger } from '@nestjs/common';
import { db, factura, empresa, documentoSustento, historialFactura, observacion, usuario, pagoFactura, relacionEmpresaContador } from '@audivare/database';
import { claveFactura, claveFacturaSql, validarDatosFactura } from './factura-datos';
import { eq, and, or, ilike, gte, lt, count, desc, sql, SQL } from 'drizzle-orm';
import { StorageService } from '../storage/storage.service';
import { PermisosService } from '../common/permisos/permisos.service';
import { NotificacionesService } from '../notificaciones/notificaciones.service';
import { validarEstadoFactura } from '../common/estado-factura.util';
import { validarTipoDocumento, validarTipoPago } from '../common/enums.util';
import { ArchivoMultipart } from '../common/multipart.util';
import { simboloMoneda } from '../common/factura-calculos.util';

/** Convierte un monto decimal a céntimos enteros para operar sin errores de punto flotante. */
function aCentimos(monto: string | number | null | undefined): number {
  return Math.round(Number(monto ?? 0) * 100);
}

/** Convierte céntimos enteros de vuelta a un monto decimal con 2 decimales exactos. */
function deCentimos(centimos: number): string {
  return (centimos / 100).toFixed(2);
}

/** El valor guardado debe coincidir exactamente con los céntimos usados en el saldo. */
function validarMontoPago(monto: number): number {
  const centimos = aCentimos(monto);
  if (!Number.isFinite(monto) || !Number.isSafeInteger(centimos) || centimos <= 0
    || Math.abs(monto - centimos / 100) > 1e-8) {
    throw new BadRequestException('El monto debe ser mayor a cero y tener como máximo dos decimales');
  }
  return centimos;
}

/**
 * Rango de fechas [desde, hasta) para filtrar por año y (opcionalmente) mes sobre
 * la fecha de emisión. El año es obligatorio para filtrar; el mes es opcional.
 * Devuelve null si no se pide filtro por fecha.
 */
function rangoPorAnioMes(anio?: string, mes?: string): { desde: string; hasta: string } | null {
  if (!anio) return null;
  const y = Number(anio);
  if (!Number.isInteger(y) || y < 2000 || y > 2100) {
    throw new BadRequestException('El año del filtro no es válido');
  }
  if (mes) {
    const m = Number(mes);
    if (!Number.isInteger(m) || m < 1 || m > 12) {
      throw new BadRequestException('El mes del filtro no es válido');
    }
    const mm = String(m).padStart(2, '0');
    const desde = `${y}-${mm}-01`;
    const hasta = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
    return { desde, hasta };
  }
  return { desde: `${y}-01-01`, hasta: `${y + 1}-01-01` };
}

/**
 * Quién opera sobre una factura. La documentación y los pagos son de paridad
 * plena entre la empresa (usuario INTERNO, autorizado por su empresa) y el
 * contador externo (autorizado por `relacion_empresa_contador` de la empresa
 * indicada en la URL). El actor decide la autorización y hacia quién van los
 * avisos (cuando actúa la empresa se avisa al contador y viceversa).
 */
export type ActorFactura =
  | { kind: 'INTERNO'; userId: string }
  | { kind: 'CONTADOR'; userId: string; empresaId: string };

type Transaccion = Parameters<Parameters<typeof db.transaction>[0]>[0];

@Injectable()
export class FacturasService {
  private readonly logger = new Logger(FacturasService.name);

  constructor(
    private readonly storageService: StorageService,
    private readonly permisosService: PermisosService,
    private readonly notificacionesService: NotificacionesService,
  ) {}

  /** Recorta un texto para el mensaje de una notificación. */
  private resumen(texto: string, max = 120): string {
    const limpio = texto.trim();
    return limpio.length > max ? `${limpio.slice(0, max - 1)}…` : limpio;
  }

  /** IDs de los contadores externos vinculados a la empresa (destinatarios de avisos de documentación). */
  private async getContadoresDeEmpresa(empresaId: string, excluir?: string): Promise<string[]> {
    const rels = await db
      .select({ contadorId: relacionEmpresaContador.contadorId })
      .from(relacionEmpresaContador)
      .where(eq(relacionEmpresaContador.empresaId, empresaId));
    return rels.map((r) => r.contadorId).filter((id) => id !== excluir);
  }

  /**
   * Resuelve y autoriza la empresa+factura sobre la que opera el actor:
   * - INTERNO: su empresa (`getEmpresaId`); la factura debe pertenecerle.
   * - CONTADOR: la empresa de la URL, exigiendo vínculo activo; la factura debe
   *   pertenecer a esa empresa.
   * Devuelve también `esContador` para invertir los destinatarios de los avisos.
   */
  private async autorizarFactura(
    actor: ActorFactura,
    facturaId: string,
  ): Promise<{ empresaId: string; facturaData: typeof factura.$inferSelect; esContador: boolean }> {
    let empresaId: string;
    if (actor.kind === 'CONTADOR') {
      empresaId = actor.empresaId;
      const rel = await db
        .select({ contadorId: relacionEmpresaContador.contadorId })
        .from(relacionEmpresaContador)
        .where(and(
          eq(relacionEmpresaContador.empresaId, empresaId),
          eq(relacionEmpresaContador.contadorId, actor.userId),
        ));
      if (!rel.length) {
        throw new ForbiddenException('No estás vinculado a esta empresa');
      }
      await this.permisosService.checkEmpresaActiva(empresaId);
    } else {
      empresaId = await this.permisosService.getEmpresaId(actor.userId);
    }

    const facturasList = await db
      .select()
      .from(factura)
      .where(and(eq(factura.id, facturaId), eq(factura.empresaId, empresaId)));

    if (!facturasList.length) {
      throw new ForbiddenException('No tiene acceso a esta factura o no existe');
    }

    return { empresaId, facturaData: facturasList[0], esContador: actor.kind === 'CONTADOR' };
  }

  async findAll(
    userId: string,
    estado?: string,
    proveedor?: string,
    anio?: string,
    mes?: string,
    page: number = 1,
    limit: number = 10,
    busqueda?: string,
  ) {
    const empresaId = await this.permisosService.getEmpresaId(userId);

    const conditions: SQL[] = [eq(factura.empresaId, empresaId)];

    if (estado && estado !== 'TODOS') {
      conditions.push(eq(factura.estadoFactura, validarEstadoFactura(estado)));
    }

    // Búsqueda por serie-número: serie, número o la combinación "serie-número".
    if (busqueda && busqueda.trim()) {
      const term = `%${busqueda.trim()}%`;
      const busquedaCondition = or(
        ilike(factura.serie, term),
        ilike(factura.numero, term),
        sql`${factura.serie} || '-' || ${factura.numero} ILIKE ${term}`,
      );
      if (busquedaCondition) {
        conditions.push(busquedaCondition);
      }
    }

    if (proveedor) {
      const proveedorCondition = or(
        ilike(factura.proveedorNombre, `%${proveedor}%`),
        ilike(factura.proveedorRuc, `%${proveedor}%`)
      );
      if (proveedorCondition) {
        conditions.push(proveedorCondition);
      }
    }

    // Filtro por año (y opcionalmente mes) sobre la fecha de emisión.
    const rango = rangoPorAnioMes(anio, mes);
    if (rango) {
      conditions.push(gte(factura.fechaEmision, rango.desde));
      conditions.push(lt(factura.fechaEmision, rango.hasta));
    }

    const whereClause = and(...conditions);

    const totalResult = await db
      .select({ count: count() })
      .from(factura)
      .where(whereClause);

    const total = totalResult[0].count;

    const offset = (page - 1) * limit;

    const data = await db
      .select({
        id: factura.id,
        serie: factura.serie,
        numero: factura.numero,
        proveedor_nombre: factura.proveedorNombre,
        proveedor_ruc: factura.proveedorRuc,
        moneda: factura.moneda,
        monto_total: factura.montoTotal,
        saldo_pendiente: factura.saldoPendiente,
        fecha_emision: factura.fechaEmision,
        estado_factura: factura.estadoFactura,
        documentacion_estado: factura.documentacionEstado,
        fecha_creacion: factura.fechaCreacion,
      })
      .from(factura)
      .where(whereClause)
      .orderBy(desc(factura.fechaEmision), desc(factura.id))
      .limit(limit)
      .offset(offset);

    return {
      data,
      total,
      page,
      limit,
    };
  }

  async findOne(userId: string, id: string) {
    const empresaId = await this.permisosService.getEmpresaId(userId);

    const facturasList = await db
      .select()
      .from(factura)
      .where(and(eq(factura.id, id), eq(factura.empresaId, empresaId)));

    if (!facturasList.length) {
      throw new ForbiddenException('No tiene acceso a esta factura o no existe');
    }

    const facturaData = facturasList[0];

    const documentos = await db
      .select()
      .from(documentoSustento)
      .where(eq(documentoSustento.facturaId, id));

    const historial = await db
      .select()
      .from(historialFactura)
      .where(eq(historialFactura.facturaId, id))
      .orderBy(desc(historialFactura.fechaEvento));

    const puedeRegistrarPago = await this.permisosService.tienePermiso(userId, 'PAGO_REGISTRAR');
    const puedeActualizarPago = await this.permisosService.tienePermiso(userId, 'PAGO_UPDATE');
    const puedeEliminarPago = await this.permisosService.tienePermiso(userId, 'PAGO_DELETE');
    const puedeSubirDocumento = await this.permisosService.tienePermiso(userId, 'DOCUMENTO_UPLOAD');
    const puedeEliminarDocumento = await this.permisosService.tienePermiso(userId, 'DOCUMENTO_DELETE');

    const puedeVerPagos = await this.permisosService.tienePermiso(userId, 'PAGO_READ');
    const pagos = puedeVerPagos
      ? await db
          .select()
          .from(pagoFactura)
          .where(eq(pagoFactura.facturaId, id))
          .orderBy(desc(pagoFactura.fechaRegistro))
      : [];

    return {
      factura: facturaData,
      puedeEditarFactura: await this.permisosService.tienePermiso(userId, 'FACTURA_UPDATE'),
      documentos,
      historial,
      puedeRegistrarPago,
      puedeActualizarPago,
      puedeEliminarPago,
      puedeSubirDocumento,
      puedeEliminarDocumento,
      // Marcar la documentación como completa/pendiente lo hace quien gestiona documentos.
      puedeMarcarDocumentacion: puedeSubirDocumento,
      pagos,
    };
  }

  private async empresaEscritura(actor: ActorFactura, codigo: string, tx: Transaccion) {
    const [u] = await tx.select().from(usuario).where(eq(usuario.id, actor.userId));
    if (actor.kind === 'INTERNO') {
      if (u?.tipoUsuario !== 'INTERNO') throw new ForbiddenException('Usuario interno requerido');
      await this.permisosService.checkPermiso(actor.userId, 'FACTURA_READ');
      return this.permisosService.checkPermiso(actor.userId, codigo);
    }
    if (u?.tipoUsuario !== 'CONTADOR_EXTERNO') throw new ForbiddenException('Contador externo requerido');
    const [rel] = await tx.select().from(relacionEmpresaContador).where(and(
      eq(relacionEmpresaContador.contadorId, actor.userId), eq(relacionEmpresaContador.empresaId, actor.empresaId)));
    if (!rel) throw new ForbiddenException('No estás vinculado a esta empresa');
    await this.permisosService.checkEmpresaActiva(actor.empresaId, tx);
    return actor.empresaId;
  }

  async guardarFactura(actor: ActorFactura, body: unknown, id?: string) {
    const datos = validarDatosFactura(body);
    return db.transaction(async tx => {
      const empresaId = await this.empresaEscritura(actor, id ? 'FACTURA_UPDATE' : 'FACTURA_CREATE', tx);
      await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${'importacion:' + empresaId}, 0))`);
      // Revalidar después de esperar una escritura concurrente.
      if (await this.empresaEscritura(actor, id ? 'FACTURA_UPDATE' : 'FACTURA_CREATE', tx) !== empresaId)
        throw new ForbiddenException('La empresa del usuario cambió');
      const anterior = id ? await this.bloquearFacturaPago(tx, id, empresaId) : null;
      const version = body && typeof body === 'object' && 'fechaActualizacion' in body ? body.fechaActualizacion : undefined;
      if (anterior && version !== undefined && (typeof version !== 'string' || anterior.fechaActualizacion?.toISOString() !== version))
        throw new ConflictException('La factura cambió mientras la editabas. Cierra el formulario y actualiza la página antes de continuar.');
      const claveIdentidad = claveFactura(datos);
      const existentes = await tx.select({ id: factura.id }).from(factura)
        .where(and(eq(factura.empresaId, empresaId), eq(claveFacturaSql, claveIdentidad)));
      const ocupada = existentes.find(f => f.id !== id);
      if (ocupada) throw new ConflictException({ message: 'El comprobante ya existe. Revísalo antes de continuar.', facturaId: ocupada.id });
      const pagos = id ? await tx.select().from(pagoFactura).where(eq(pagoFactura.facturaId, id)) : [];
      if (pagos.length && anterior?.moneda !== datos.moneda) throw new BadRequestException('No puedes cambiar la moneda de una factura con pagos');
      const pagado = pagos.reduce((s, p) => s + aCentimos(p.montoPagado), 0);
      const saldo = aCentimos(datos.montoTotal) - pagado;
      if (saldo < 0) throw new BadRequestException('El total no puede ser menor que los pagos registrados');
      const valores = { ...datos, claveIdentidad, saldoPendiente: deCentimos(saldo),
        estadoFactura: (saldo === 0 ? 'PAGADA' : 'ACTIVA') as 'PAGADA' | 'ACTIVA', fechaActualizacion: new Date() };
      const cambios = anterior ? Object.entries(datos).filter(([k, v]) => anterior[k as keyof typeof anterior] !== v)
        .map(([campo, despues]) => ({ campo, antes: anterior[campo as keyof typeof anterior], despues })) : [];
      if (id && !cambios.length) return anterior;
      const [receptor] = await tx.select().from(empresa).where(eq(empresa.id, empresaId));
      const [guardada] = id ? await tx.update(factura).set(valores).where(and(eq(factura.id, id), eq(factura.empresaId, empresaId))).returning()
        : await tx.insert(factura).values({ ...valores, empresaId, creadoPor: actor.userId,
          receptorRuc: receptor.ruc, receptorRazonSocial: receptor.razonSocial }).returning();
      const [autor] = await tx.select({ nombre: usuario.nombreCompleto }).from(usuario).where(eq(usuario.id, actor.userId));
      await tx.insert(historialFactura).values({ facturaId: guardada.id, usuarioId: actor.userId,
        evento: id ? 'Datos de factura editados' : 'Factura registrada individualmente',
        detalle: JSON.stringify({ autor: autor.nombre, cambios: id ? cambios : datos }) });
      return guardada;
    });
  }

  async uploadDocumento(actor: ActorFactura, id: string, file: ArchivoMultipart, tipoDocumento: string, descripcion?: string) {
    const { empresaId, facturaData, esContador } = await this.autorizarFactura(actor, id);

    const tipoDocumentoValidado = validarTipoDocumento(tipoDocumento);

    // Para "OTROS" se debe indicar el tipo escrito (se guarda en descripción).
    const descripcionLimpia = descripcion?.trim() || null;
    if (tipoDocumentoValidado === 'OTROS' && !descripcionLimpia) {
      throw new BadRequestException('Para el tipo "Otros" debes indicar qué documento es');
    }

    const storagePath = await this.storageService.uploadFile(file, `facturas/${id}`);

    const newDoc = await db.transaction(async (tx) => {
      const inserted = await tx.insert(documentoSustento).values({
        facturaId: id,
        tipoDocumento: tipoDocumentoValidado,
        descripcion: descripcionLimpia,
        archivoStoragePath: storagePath,
        archivoNombreOriginal: file.filename,
        subidoPor: actor.userId,
      }).returning();

      await tx.insert(historialFactura).values({
        facturaId: id,
        usuarioId: actor.userId,
        evento: `Documento cargado: ${tipoDocumentoValidado}`,
        detalle: descripcionLimpia || `Archivo: ${file.filename}`,
      });

      // Aviso a la otra parte: si carga la empresa → a los contadores vinculados;
      // si carga el contador → a los internos con FACTURA_READ.
      const etiqueta = descripcionLimpia || tipoDocumentoValidado;
      const metadata = {
        empresa_id: empresaId,
        factura_id: id,
        factura_serie: facturaData.serie ?? undefined,
        factura_numero: facturaData.numero ?? undefined,
        documento_id: inserted[0].id,
        documento_tipo: tipoDocumentoValidado,
      };
      if (esContador) {
        const internos = await this.permisosService.getUsuariosConPermiso(empresaId, 'FACTURA_READ');
        for (const internoId of internos) {
          await this.notificacionesService.crearNotificacion(
            internoId,
            'DOCUMENTO_CARGADO',
            'Documentación cargada por el contador',
            `El contador cargó documentación (${etiqueta}) en la factura ${facturaData.serie}-${facturaData.numero}.`,
            metadata,
            tx,
          );
        }
      } else {
        const contadores = await this.getContadoresDeEmpresa(empresaId, actor.userId);
        for (const contadorId of contadores) {
          await this.notificacionesService.crearNotificacion(
            contadorId,
            'DOCUMENTO_CARGADO',
            'Documentación cargada',
            `Se cargó documentación (${etiqueta}) en la factura ${facturaData.serie}-${facturaData.numero}.`,
            metadata,
            tx,
          );
        }
      }

      return inserted[0];
    });

    return newDoc;
  }

  async replaceDocumento(actor: ActorFactura, facturaId: string, documentoId: string, file: ArchivoMultipart) {
    await this.autorizarFactura(actor, facturaId);
    const userId = actor.userId;

    const docs = await db
      .select()
      .from(documentoSustento)
      .where(and(eq(documentoSustento.id, documentoId), eq(documentoSustento.facturaId, facturaId)));

    if (!docs.length) {
      throw new NotFoundException('Documento no encontrado');
    }

    const doc = docs[0];
    const pathAnterior = doc.archivoStoragePath;

    // Se sube el nuevo archivo primero; solo si tiene éxito se borra el anterior.
    const nuevoStoragePath = await this.storageService.uploadFile(file, `facturas/${facturaId}`);

    const updated = await db
      .update(documentoSustento)
      .set({
        archivoStoragePath: nuevoStoragePath,
        archivoNombreOriginal: file.filename,
        subidoPor: userId,
        fechaSubida: new Date(),
      })
      .where(eq(documentoSustento.id, documentoId))
      .returning();

    if (pathAnterior && pathAnterior !== nuevoStoragePath) {
      await this.storageService.deleteFile(pathAnterior);
    }

    await db.insert(historialFactura).values({
      facturaId,
      usuarioId: userId,
      evento: `Documento reemplazado: ${doc.tipoDocumento}`,
      detalle: `Nuevo archivo: ${file.filename}`,
    });

    return updated[0];
  }

  async getDownloadUrl(userId: string, id: string, documentoId: string) {
    const empresaId = await this.permisosService.getEmpresaId(userId);

    const facturasList = await db
      .select()
      .from(factura)
      .where(and(eq(factura.id, id), eq(factura.empresaId, empresaId)));

    if (!facturasList.length) {
      throw new ForbiddenException('No tiene acceso a esta factura o no existe');
    }

    const docs = await db
      .select()
      .from(documentoSustento)
      .where(and(eq(documentoSustento.id, documentoId), eq(documentoSustento.facturaId, id)));

    if (!docs.length) {
      throw new NotFoundException('Documento no encontrado');
    }

    const url = await this.storageService.getPresignedUrl(docs[0].archivoStoragePath, await this.permisosService.getSegundosDescarga(empresaId));
    return { url };
  }

  /** La empresa o el contador marca la documentación de la factura como completa o pendiente. */
  async marcarDocumentacion(actor: ActorFactura, id: string, completa: boolean) {
    const { empresaId, facturaData, esContador } = await this.autorizarFactura(actor, id);
    const userId = actor.userId;
    const nuevoEstado = completa ? 'COMPLETA' : 'PENDIENTE';

    if (facturaData.documentacionEstado === nuevoEstado) {
      return { id, documentacion_estado: nuevoEstado, mensaje: 'Sin cambios' };
    }

    await db.transaction(async (tx) => {
      await tx.update(factura)
        .set({
          documentacionEstado: nuevoEstado,
          documentacionCompletadaPor: completa ? userId : null,
          documentacionCompletadaEn: completa ? new Date() : null,
          fechaActualizacion: new Date(),
        })
        .where(eq(factura.id, id));

      await tx.insert(historialFactura).values({
        facturaId: id,
        usuarioId: userId,
        evento: completa ? 'Documentación marcada como completa' : 'Documentación marcada como pendiente',
      });

      // Al completar se avisa a la otra parte: si marca la empresa → contadores;
      // si marca el contador → internos con FACTURA_READ.
      if (completa) {
        const metadata = {
          empresa_id: empresaId,
          factura_id: id,
          factura_serie: facturaData.serie ?? undefined,
          factura_numero: facturaData.numero ?? undefined,
        };
        if (esContador) {
          const internos = await this.permisosService.getUsuariosConPermiso(empresaId, 'FACTURA_READ');
          for (const internoId of internos) {
            await this.notificacionesService.crearNotificacion(
              internoId,
              'DOCUMENTACION_COMPLETADA',
              'Documentación completa',
              `El contador marcó como completa la documentación de la factura ${facturaData.serie}-${facturaData.numero}.`,
              metadata,
              tx,
            );
          }
        } else {
          const contadores = await this.getContadoresDeEmpresa(empresaId, userId);
          for (const contadorId of contadores) {
            await this.notificacionesService.crearNotificacion(
              contadorId,
              'DOCUMENTACION_COMPLETADA',
              'Documentación completa',
              `La empresa marcó como completa la documentación de la factura ${facturaData.serie}-${facturaData.numero}.`,
              metadata,
              tx,
            );
          }
        }
      }
    });

    return { id, documentacion_estado: nuevoEstado, mensaje: 'Documentación actualizada' };
  }

  async getObservacionesExternas(userId: string, id: string) {
    const empresaId = await this.permisosService.getEmpresaId(userId);

    const facturasList = await db
      .select()
      .from(factura)
      .where(and(eq(factura.id, id), eq(factura.empresaId, empresaId)));

    if (!facturasList.length) {
      throw new ForbiddenException('No tiene acceso a esta factura o no existe');
    }

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
      .where(and(eq(observacion.facturaId, id), eq(observacion.tipo, 'EXTERNA')))
      .orderBy(desc(observacion.fechaCreacion));

    const data = observacionesList.map(obs => ({
      ...obs,
      usuarioNombre: [{ nombre: obs.usuarioNombre || 'Usuario Desconocido' }]
    }));

    const puedeAtender = await this.permisosService.tienePermiso(userId, 'OBSERVACION_WRITE');

    return { data, puedeAtender };
  }

  async atenderObservacion(userId: string, facturaId: string, observacionId: string, respuesta?: string) {
    const empresaId = await this.permisosService.getEmpresaId(userId);

    const facturasList = await db
      .select()
      .from(factura)
      .where(and(eq(factura.id, facturaId), eq(factura.empresaId, empresaId)));

    if (!facturasList.length) {
      throw new ForbiddenException('No tiene acceso a esta factura o no existe');
    }

    const observacionesList = await db
      .select()
      .from(observacion)
      .where(and(eq(observacion.id, observacionId), eq(observacion.facturaId, facturaId)));

    if (!observacionesList.length) {
      throw new NotFoundException('Solicitud no encontrada');
    }

    const obs = observacionesList[0];

    if (obs.atendida) {
      throw new BadRequestException('La solicitud ya fue atendida');
    }

    const facturaData = facturasList[0];
    const respuestaLimpia = respuesta?.trim() || null;
    // Destinatarios: el equipo interno con OBSERVACION_READ (excluye a quien atiende)
    // más el autor de la solicitud (el contador externo).
    const destinatarios = new Set(
      await this.permisosService.getUsuariosConPermiso(empresaId, 'OBSERVACION_READ', userId),
    );
    if (obs.creadoPor !== userId) {
      destinatarios.add(obs.creadoPor);
    }

    await db.transaction(async (tx) => {
      await tx.update(observacion)
        .set({
          atendida: true,
          respuesta: respuestaLimpia,
          fechaAtencion: new Date(),
        })
        .where(eq(observacion.id, observacionId));

      await tx.insert(historialFactura).values({
        facturaId,
        usuarioId: userId,
        evento: 'Solicitud del contador atendida',
        detalle: respuestaLimpia ? `Respuesta: ${respuestaLimpia}` : obs.contenido,
      });

      const sufijo = respuestaLimpia ? ` Respuesta: ${this.resumen(respuestaLimpia)}` : '';
      for (const destinatarioId of destinatarios) {
        const esAutor = destinatarioId === obs.creadoPor;
        const mensaje = esAutor
          ? `La empresa atendió tu solicitud en la factura ${facturaData.serie}-${facturaData.numero}.${sufijo}`
          : `Se atendió una solicitud del contador en la factura ${facturaData.serie}-${facturaData.numero}.${sufijo}`;

        await this.notificacionesService.crearNotificacion(
          destinatarioId,
          'OBSERVACION_ATENDIDA',
          'Solicitud atendida',
          mensaje,
          {
            factura_id: facturaId,
            factura_serie: facturaData.serie ?? undefined,
            factura_numero: facturaData.numero ?? undefined,
            observacion_id: observacionId,
            empresa_id: empresaId,
          },
          tx,
        );
      }
    });

    return {
      id: observacionId,
      atendida: true,
      mensaje: 'Solicitud atendida',
    };
  }

  async getPagos(userId: string, id: string) {
    const empresaId = await this.permisosService.getEmpresaId(userId);

    const facturasList = await db
      .select()
      .from(factura)
      .where(and(eq(factura.id, id), eq(factura.empresaId, empresaId)));

    if (!facturasList.length) {
      throw new ForbiddenException('No tiene acceso a esta factura o no existe');
    }

    const pagos = await db
      .select()
      .from(pagoFactura)
      .where(eq(pagoFactura.facturaId, id))
      .orderBy(desc(pagoFactura.fechaRegistro));

    return pagos;
  }

  async getPagoComprobanteUrl(actor: ActorFactura, facturaId: string, pagoId: string) {
    const { empresaId } = await this.autorizarFactura(actor, facturaId);

    const pagosList = await db
      .select()
      .from(pagoFactura)
      .where(and(eq(pagoFactura.id, pagoId), eq(pagoFactura.facturaId, facturaId)));

    if (!pagosList.length) {
      throw new NotFoundException('Pago no encontrado');
    }

    if (!pagosList[0].comprobantePath) {
      throw new NotFoundException('Este pago no tiene comprobante');
    }

    const url = await this.storageService.getPresignedUrl(pagosList[0].comprobantePath, await this.permisosService.getSegundosDescarga(empresaId));
    return { url };
  }

  async registrarPago(actor: ActorFactura, id: string, data: { montoPagado: number, nota?: string, tipoPago?: string, file: ArchivoMultipart }) {
    const { empresaId, esContador } = await this.autorizarFactura(actor, id);
    const userId = actor.userId;
    const tipoPago = validarTipoPago(data.tipoPago);

    const pagoCentimos = validarMontoPago(data.montoPagado);

    if (!data.file || !data.file.filename) {
      throw new BadRequestException('El comprobante de pago es obligatorio');
    }

    const nota = data.nota?.trim() || null;
    const storagePath = await this.storageService.uploadFile(data.file, `facturas/${id}/pagos`);
    const fileName = data.file.filename;

    // Destinatarios: internos activos con PAGO_READ (o Administrador). Si registra
    // un interno se excluye a sí mismo; si registra el contador no se excluye a nadie.
    const destinatarios = await this.permisosService.getUsuariosConPermiso(empresaId, 'PAGO_READ', esContador ? undefined : userId);

    return db.transaction(async (tx) => {
      const facturaData = await this.bloquearFacturaPago(tx, id, empresaId);
      if (facturaData.estadoFactura !== 'ACTIVA') {
        throw new BadRequestException('Solo se pueden registrar pagos en facturas con estado ACTIVA');
      }
      const saldoCentimos = aCentimos(facturaData.saldoPendiente);
      if (pagoCentimos > saldoCentimos) {
        throw new BadRequestException('El monto excede el saldo pendiente');
      }
      const nuevoSaldoCentimos = saldoCentimos - pagoCentimos;
      const nuevoSaldo = deCentimos(nuevoSaldoCentimos);
      const isPagada = nuevoSaldoCentimos === 0;
      const nuevoEstado = isPagada ? 'PAGADA' : 'ACTIVA';
      const simbolo = simboloMoneda(facturaData.moneda);
      const pagoInsertado = await tx.insert(pagoFactura).values({
        facturaId: id,
        montoPagado: deCentimos(pagoCentimos),
        tipoPago,
        nota,
        comprobantePath: storagePath,
        comprobanteNombre: fileName,
        registradoPor: userId,
      }).returning({ id: pagoFactura.id });

      await tx.update(factura)
        .set({
          saldoPendiente: nuevoSaldo,
          estadoFactura: nuevoEstado,
          fechaActualizacion: new Date(),
        })
        .where(eq(factura.id, id));

      // Fechas explícitas para garantizar el orden cronológico dentro de la transacción.
      const ahoraPago = new Date();
      await tx.insert(historialFactura).values({
        facturaId: id,
        usuarioId: userId,
        evento: `Pago registrado: ${simbolo} ${data.montoPagado}${tipoPago === 'DETRACCION' ? ' (detracción)' : ''}`,
        detalle: nota || undefined,
        fechaEvento: ahoraPago,
      });

      if (isPagada) {
        await tx.insert(historialFactura).values({
          facturaId: id,
          usuarioId: userId,
          evento: 'Factura pagada completamente',
          fechaEvento: new Date(ahoraPago.getTime() + 1000),
        });
      }

      const detalleSaldo = isPagada
        ? 'La factura quedó totalmente pagada.'
        : `Saldo pendiente: ${simbolo} ${nuevoSaldo}.`;
      for (const destinatarioId of destinatarios) {
        await this.notificacionesService.crearNotificacion(
          destinatarioId,
          'PAGO_REGISTRADO',
          'Pago registrado',
          `${esContador ? 'El contador registró' : 'Se registró'} un pago de ${simbolo} ${data.montoPagado} en la factura ${facturaData.serie}-${facturaData.numero}. ${detalleSaldo}`,
          {
            factura_id: id,
            factura_serie: facturaData.serie ?? undefined,
            factura_numero: facturaData.numero ?? undefined,
            pago_id: pagoInsertado[0].id,
          },
          tx,
        );
      }
      return {
        id,
        monto_pagado: data.montoPagado,
        comprobante_nombre: fileName,
        saldo_pendiente_actualizado: Number(nuevoSaldo),
        factura_pagada: isPagada,
      };
    }, { isolationLevel: 'read committed' });
  }

  /** Una sola operación de pagos por factura; leer saldo/pago solo después del bloqueo. */
  private async bloquearFacturaPago(tx: Transaccion, facturaId: string, empresaId: string) {
    const [actual] = await tx.select().from(factura)
      .where(and(eq(factura.id, facturaId), eq(factura.empresaId, empresaId)))
      .for('update');
    if (!actual) throw new NotFoundException('Factura no encontrada en esta empresa');
    return actual;
  }

  async actualizarPago(actor: ActorFactura, facturaId: string, pagoId: string, data: { montoPagado: number, nota?: string, tipoPago?: string, file: ArchivoMultipart | null }) {
    const { empresaId } = await this.autorizarFactura(actor, facturaId);
    const userId = actor.userId;
    const tipoPago = validarTipoPago(data.tipoPago);
    const nuevoPagoCentimos = validarMontoPago(data.montoPagado);
    const nota = data.nota?.trim() || null;
    // No mantener el bloqueo mientras se comunica con el almacenamiento.
    const nuevoArchivo = data.file?.filename ? {
      path: await this.storageService.uploadFile(data.file, `facturas/${facturaId}/pagos`),
      nombre: data.file.filename,
    } : null;

    const { resultado, pathAnterior } = await db.transaction(async (tx) => {
      const facturaData = await this.bloquearFacturaPago(tx, facturaId, empresaId);
      if (facturaData.estadoFactura !== 'ACTIVA' && facturaData.estadoFactura !== 'PAGADA') {
        throw new BadRequestException('Solo se pueden editar pagos de facturas activas o pagadas');
      }
      const [pagoActual] = await tx.select().from(pagoFactura)
        .where(and(eq(pagoFactura.id, pagoId), eq(pagoFactura.facturaId, facturaId)));
      if (!pagoActual) throw new NotFoundException('Pago no encontrado');
      const saldoSinEstePagoCentimos = aCentimos(facturaData.saldoPendiente) + aCentimos(pagoActual.montoPagado);
      if (nuevoPagoCentimos > saldoSinEstePagoCentimos) {
        throw new BadRequestException('El monto excede el saldo pendiente disponible');
      }
      const nuevoSaldo = deCentimos(saldoSinEstePagoCentimos - nuevoPagoCentimos);
      const isPagada = saldoSinEstePagoCentimos === nuevoPagoCentimos;
      const storagePath = nuevoArchivo?.path ?? pagoActual.comprobantePath;
      const fileName = nuevoArchivo?.nombre ?? pagoActual.comprobanteNombre;
      await tx.update(pagoFactura)
        .set({
          montoPagado: deCentimos(nuevoPagoCentimos),
          tipoPago,
          nota,
          comprobantePath: storagePath,
          comprobanteNombre: fileName,
        })
        .where(eq(pagoFactura.id, pagoId));

      await tx.update(factura)
        .set({
          saldoPendiente: nuevoSaldo,
          estadoFactura: isPagada ? 'PAGADA' : 'ACTIVA',
          fechaActualizacion: new Date(),
        })
        .where(eq(factura.id, facturaId));

      await tx.insert(historialFactura).values({
        facturaId: facturaId,
        usuarioId: userId,
        evento: `Pago actualizado: ${simboloMoneda(facturaData.moneda)} ${data.montoPagado}`,
        detalle: nota || undefined,
      });
      return {
        pathAnterior: storagePath !== pagoActual.comprobantePath ? pagoActual.comprobantePath : null,
        resultado: {
          id: pagoId,
          monto_pagado: data.montoPagado,
          comprobante_nombre: fileName,
          saldo_pendiente_actualizado: Number(nuevoSaldo),
          factura_pagada: isPagada,
        },
      };
    }, { isolationLevel: 'read committed' });

    if (pathAnterior) {
      try {
        await this.storageService.deleteFile(pathAnterior);
      } catch (error) {
        // El cambio ya está confirmado: no devolver error ni inducir un reintento del pago.
        this.logger.warn(
          `Pago ${pagoId} actualizado; no se pudo retirar su comprobante anterior: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    return resultado;
  }

  async deletePago(actor: ActorFactura, facturaId: string, pagoId: string) {
    const { empresaId } = await this.autorizarFactura(actor, facturaId);
    const userId = actor.userId;

    const { pago, nuevoSaldo } = await db.transaction(async (tx) => {
      const facturaData = await this.bloquearFacturaPago(tx, facturaId, empresaId);
      const [pago] = await tx.select().from(pagoFactura)
        .where(and(eq(pagoFactura.id, pagoId), eq(pagoFactura.facturaId, facturaId)));
      if (!pago) throw new NotFoundException('Pago no encontrado');
      // Sumar una sola vez el importe vigente, incluso ante borrados repetidos.
      const nuevoSaldo = deCentimos(aCentimos(facturaData.saldoPendiente) + aCentimos(pago.montoPagado));
      await tx.delete(pagoFactura).where(eq(pagoFactura.id, pagoId));

      await tx.update(factura)
        .set({
          saldoPendiente: nuevoSaldo,
          estadoFactura: 'ACTIVA',
          fechaActualizacion: new Date(),
        })
        .where(eq(factura.id, facturaId));

      await tx.insert(historialFactura).values({
        facturaId,
        usuarioId: userId,
        evento: `Pago eliminado: ${simboloMoneda(facturaData.moneda)} ${pago.montoPagado}`,
        detalle: facturaData.estadoFactura === 'PAGADA'
          ? 'La factura vuelve a estado ACTIVA por la eliminación del pago.'
          : undefined,
      });
      return { pago, nuevoSaldo };
    }, { isolationLevel: 'read committed' });

    // El comprobante en MinIO se borra después de la BD; si falla deja un huérfano recuperable.
    if (pago.comprobantePath) {
      try {
        await this.storageService.deleteFile(pago.comprobantePath);
      } catch (error) {
        this.logger.warn(
          `No se pudo eliminar el comprobante del pago ${pagoId} (${pago.comprobantePath}) de la factura ${facturaId}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    return {
      id: pagoId,
      saldo_pendiente_actualizado: Number(nuevoSaldo),
      estado_factura: 'ACTIVA',
      mensaje: 'Pago eliminado exitosamente',
    };
  }

  async deleteDocumento(actor: ActorFactura, facturaId: string, documentoId: string) {
    await this.autorizarFactura(actor, facturaId);
    const userId = actor.userId;

    const pathAnterior = await db.transaction(async tx => {
      const [doc] = await tx.select().from(documentoSustento)
        .where(and(eq(documentoSustento.id, documentoId), eq(documentoSustento.facturaId, facturaId))).for('update');
      if (!doc) throw new NotFoundException('Documento no encontrado');
      await tx.delete(documentoSustento).where(eq(documentoSustento.id, documentoId));
      await tx.insert(historialFactura).values({ facturaId, usuarioId: userId, evento: `Documento eliminado: ${doc.tipoDocumento}` });
      return doc.archivoStoragePath;
    });
    if (pathAnterior) {
      try { await this.storageService.deleteFile(pathAnterior); }
      catch { this.logger.warn('Documento retirado de BD; limpieza del objeto pendiente de conciliación'); }
    }

    return { message: 'Documento eliminado exitosamente' };
  }
}
