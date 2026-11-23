import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import {
  db,
  documentoMensual,
  eventoDocumentoMensual,
  documentoEmpresa,
  relacionEmpresaContador,
  usuario,
} from "@audivare/database";
import { and, eq, isNull, desc, asc, inArray, count, ilike } from "drizzle-orm";
import { busquedaListado, patronBusqueda, paginaListado } from "../common/consulta-listado";
import sharp from "sharp";
import { CupoTrabajo } from "../common/limites-trabajo";
const cupoDescargaOriginal = new CupoTrabajo(2);
const DOCUMENTOS_POR_PAGINA = 10;
import { PermisosService } from "../common/permisos/permisos.service";
import { StorageService } from "../storage/storage.service";
import {
  NotificacionesService,
  DbExecutor,
} from "../notificaciones/notificaciones.service";
import { ArchivoMultipart } from "../common/multipart.util";
import { validarAdjunto } from "../common/archivo-adjunto.util";
import { revisarPdf } from "../storage/analisis-archivos.service";
import {
  periodo,
  periodoConsulta,
  categoria,
  nota,
  seleccion,
  Categoria,
  ETIQUETAS,
} from "./documento-datos";

export interface ActorMensual {
  id: string;
  tipo_usuario: string;
}
type Documento = typeof documentoMensual.$inferSelect;
const camposPublicos = {
  id: documentoMensual.id,
  anio: documentoMensual.anio,
  mes: documentoMensual.mes,
  categoria: documentoMensual.categoria,
  nota: documentoMensual.nota,
  archivoNombre: documentoMensual.archivoNombre,
  archivoMime: documentoMensual.archivoMime,
  archivoBytes: documentoMensual.archivoBytes,
  fechaCarga: documentoMensual.fechaCarga,
  actualizadoEn: documentoMensual.actualizadoEn,
};
const snapshot = (d: Documento) => ({
  anio: d.anio,
  mes: d.mes,
  categoria: d.categoria,
  nota: d.nota,
  archivoNombre: d.archivoNombre,
  archivoMime: d.archivoMime,
  archivoBytes: d.archivoBytes,
});

@Injectable()
export class DocumentosMensualesService {
  constructor(
    private readonly permisos: PermisosService,
    readonly storage: StorageService,
    private readonly avisos: NotificacionesService,
  ) {}

  async autorizar(
    actor: ActorMensual,
    permiso: string,
    empresaId?: string,
  ): Promise<string> {
    if (actor.tipo_usuario === "INTERNO") {
      if (permiso === "DOCUMENTO_MENSUAL_EXPORT")
        throw new ForbiddenException("La descarga del PDF corresponde al contador externo");
      const id = await this.permisos.checkPermiso(actor.id, permiso);
      if (empresaId && empresaId !== id)
        throw new ForbiddenException("No tienes acceso a esta empresa");
      return id;
    }
    if (
      actor.tipo_usuario !== "CONTADOR_EXTERNO" ||
      !empresaId ||
      !["DOCUMENTO_MENSUAL_READ", "DOCUMENTO_MENSUAL_EXPORT", "DOCUMENTO_MENSUAL_CREATE", "DOCUMENTO_MENSUAL_UPDATE"].includes(permiso)
    ) {
      throw new ForbiddenException("No tienes permiso para esta operación");
    }
    const [rel] = await db
      .select()
      .from(relacionEmpresaContador)
      .where(
        and(
          eq(relacionEmpresaContador.empresaId, empresaId),
          eq(relacionEmpresaContador.contadorId, actor.id),
        ),
      );
    if (!rel) throw new ForbiddenException("No estás vinculado a esta empresa");
    await this.permisos.checkEmpresaActiva(empresaId);
    return empresaId;
  }

  async resumen(actor: ActorMensual) {
    const empresaId = await this.autorizar(actor, "DOCUMENTO_MENSUAL_READ");
    const permisos = await this.permisos.getPermisos(actor.id);
    const [grupos, generales] = await Promise.all([
      db.select({ categoria: documentoMensual.categoria, total: count() }).from(documentoMensual)
        .where(and(eq(documentoMensual.empresaId, empresaId), isNull(documentoMensual.eliminadoEn)))
        .groupBy(documentoMensual.categoria),
      permisos.includes("DOCUMENTO_EMPRESA_MANAGE")
        ? db.select({ total: count() }).from(documentoEmpresa).where(eq(documentoEmpresa.empresaId, empresaId))
        : Promise.resolve(null),
    ]);
    return {
      facturas: grupos.find(g => g.categoria === "FACTURA")?.total ?? 0,
      sustentos: grupos.filter(g => g.categoria !== "FACTURA").reduce((total, g) => total + g.total, 0),
      documentosEmpresa: generales?.[0]?.total ?? null,
    };
  }

  async listar(
    actor: ActorMensual,
    consulta: {
      anio?: unknown;
      mes?: unknown;
      categoria?: unknown;
      pagina?: unknown;
      busqueda?: unknown;
    },
    empresa?: string,
  ) {
    const empresaId = await this.autorizar(
      actor,
      "DOCUMENTO_MENSUAL_READ",
      empresa,
    );
    const p = periodoConsulta(consulta.anio, consulta.mes);
    const pagina = paginaListado(consulta.pagina);
    const busqueda = busquedaListado(consulta.busqueda);
    const filtros = [
      eq(documentoMensual.empresaId, empresaId),
      isNull(documentoMensual.eliminadoEn),
    ];
    if (p.anio !== undefined) filtros.push(eq(documentoMensual.anio, p.anio));
    if (p.mes !== undefined) filtros.push(eq(documentoMensual.mes, p.mes));
    if (busqueda) filtros.push(ilike(documentoMensual.nota, patronBusqueda(busqueda)));
    if (consulta.categoria)
      filtros.push(
        eq(documentoMensual.categoria, categoria(consulta.categoria)),
      );
    const [total] = await db
      .select({ total: count() })
      .from(documentoMensual)
      .where(and(...filtros));
    const data = await db
      .select({ ...camposPublicos, autor: usuario.nombreCompleto })
      .from(documentoMensual)
      .leftJoin(usuario, eq(usuario.id, documentoMensual.creadoPor))
      .where(and(...filtros))
      .orderBy(desc(documentoMensual.fechaCarga), desc(documentoMensual.id))
      .limit(DOCUMENTOS_POR_PAGINA)
      .offset((pagina - 1) * DOCUMENTOS_POR_PAGINA);
    return { data, total: total.total, pagina, porPagina: DOCUMENTOS_POR_PAGINA };
  }

  private async cargar(
    empresaId: string,
    id: string,
    executor: DbExecutor = db,
    bloquear = false,
  ) {
    const q = executor
      .select()
      .from(documentoMensual)
      .where(
        and(
          eq(documentoMensual.id, id),
          eq(documentoMensual.empresaId, empresaId),
          isNull(documentoMensual.eliminadoEn),
        ),
      );
    const [doc] = await (bloquear ? q.for("update") : q);
    if (!doc) throw new NotFoundException("Documento no disponible");
    return doc;
  }
  private async evento(
    executor: DbExecutor,
    actor: ActorMensual,
    doc: Documento,
    accion: "CARGA" | "EDICION" | "ELIMINACION",
    anterior?: Documento,
    archivoReemplazado = false,
  ) {
    await executor.insert(eventoDocumentoMensual).values({
      empresaId: doc.empresaId,
      documentoId: doc.id,
      actorId: actor.id,
      accion,
      antes: anterior ? snapshot(anterior) : null,
      despues: accion === "ELIMINACION" ? null : { ...snapshot(doc), ...(archivoReemplazado ? { archivoReemplazado: true } : {}) },
    });
    const contadores = await executor
      .select()
      .from(relacionEmpresaContador)
      .where(eq(relacionEmpresaContador.empresaId, doc.empresaId));
    const internos = await this.permisos.getUsuariosConPermiso(
      doc.empresaId,
      "DOCUMENTO_MENSUAL_READ",
      actor.id,
      executor,
    );
    const destinatarios = new Set([
      ...contadores.map((rel) => rel.contadorId),
      ...internos,
    ]);
    destinatarios.delete(actor.id);
    const [autor] = await executor.select({ nombre: usuario.nombreCompleto, email: usuario.email })
      .from(usuario).where(eq(usuario.id, actor.id));
    const quien = `${actor.tipo_usuario === "CONTADOR_EXTERNO" ? "El contador" : "El usuario de empresa"} ${autor?.nombre || autor?.email || "sin nombre"}`;
    const cambios: string[] = [];
    if (anterior && anterior.nota !== doc.nota) cambios.push("la nota");
    if (anterior && (anterior.anio !== doc.anio || anterior.mes !== doc.mes)) cambios.push("el periodo");
    if (archivoReemplazado) cambios.push("el archivo");
    const detalle = accion === "CARGA" ? "cargó" : accion === "ELIMINACION" ? "eliminó"
      : `modificó ${cambios.length ? cambios.join(", ") : "los datos"} de`;
    const descripcion = doc.categoria === "FACTURA" ? "una factura" : `un sustento (${ETIQUETAS[doc.categoria].toLowerCase()})`;
    const mensaje = `${quien} ${detalle} ${descripcion} · ${String(doc.mes).padStart(2, "0")}/${doc.anio} · ${doc.nota || anterior?.nota || "Sin referencia"}`.slice(0, 500);
    for (const destinatario of destinatarios)
      await this.avisos.crearNotificacion(
        destinatario,
        "DOCUMENTO_EMPRESA_CARGADO",
        accion === "CARGA"
          ? "Documento cargado"
          : accion === "EDICION"
            ? "Documento actualizado"
            : "Documento eliminado",
        mensaje,
        {
          empresa_id: doc.empresaId,
          documento_id: doc.id,
          documento_titulo: ETIQUETAS[doc.categoria],
          documento_mensual: true,
        },
        executor,
      );
  }

  async subir(
    actor: ActorMensual,
    file: ArchivoMultipart,
    datos: {
      anio?: unknown;
      mes?: unknown;
      categoria?: unknown;
      nota?: unknown;
    },
    empresa?: string,
  ) {
    const empresaId = await this.autorizar(actor, "DOCUMENTO_MENSUAL_CREATE", empresa);
    const p = periodo(datos.anio, datos.mes),
      tipo = categoria(datos.categoria),
      texto = nota(datos.nota);
    const valido = validarAdjunto(file);
    await this.validarImagen(file, valido.mimetype);
    if (
      valido.mimetype === "application/pdf" &&
      (await revisarPdf(file.buffer)) !== "ACEPTADO"
    )
      throw new BadRequestException(
        "El PDF está protegido, dañado o contiene acciones no admitidas. Usa un PDF de consulta.",
      );
    const path = await this.storage.uploadFile(
      file,
      `empresa/${empresaId}/mensuales`,
    );
    try {
      await this.autorizar(actor, "DOCUMENTO_MENSUAL_CREATE", empresaId);
      return await db.transaction(async (tx) => {
        const [doc] = await tx
          .insert(documentoMensual)
          .values({
            empresaId,
            ...p,
            categoria: tipo,
            nota: texto,
            archivoPath: path,
            archivoNombre: file.filename,
            archivoMime: valido.mimetype,
            archivoBytes: file.buffer.length,
            creadoPor: actor.id,
          })
          .returning();
        await this.evento(tx, actor, doc, "CARGA");
        return { id: doc.id, ...p, categoria: tipo };
      });
    } catch (error) {
      await this.storage.deleteFile(path).catch(() => undefined);
      throw error;
    }
  }

  async editar(
    actor: ActorMensual,
    id: string,
    datos: { anio?: unknown; mes?: unknown; nota?: unknown },
    file?: ArchivoMultipart,
    empresa?: string,
  ) {
    const empresaId = await this.autorizar(actor, "DOCUMENTO_MENSUAL_UPDATE", empresa);
    const p = periodo(datos.anio, datos.mes),
      texto = nota(datos.nota);
    await this.cargar(empresaId, id);
    let nuevoPath: string | undefined;
    let mime: string | undefined;
    if (file) {
      mime = validarAdjunto(file).mimetype;
      await this.validarImagen(file, mime);
      if (mime === "application/pdf" && (await revisarPdf(file.buffer)) !== "ACEPTADO")
        throw new BadRequestException("El PDF está protegido, dañado o contiene acciones no admitidas. Usa un PDF de consulta.");
      nuevoPath = await this.storage.uploadFile(file, `empresa/${empresaId}/mensuales`);
    }
    let resultado: { id: string; anteriorPath: string };
    try {
      await this.autorizar(actor, "DOCUMENTO_MENSUAL_UPDATE", empresaId);
      resultado = await db.transaction(async (tx) => {
      const anterior = await this.cargar(empresaId, id, tx, true);
      const [doc] = await tx
        .update(documentoMensual)
        .set({ ...p, nota: texto, actualizadoEn: new Date(), ...(nuevoPath && file ? {
          archivoPath: nuevoPath, archivoNombre: file.filename, archivoMime: mime!, archivoBytes: file.buffer.length,
        } : {}) })
        .where(eq(documentoMensual.id, id))
        .returning();
      await this.evento(tx, actor, doc, "EDICION", anterior, !!file);
      return { id: doc.id, anteriorPath: anterior.archivoPath };
    });
    } catch (error) {
      if (nuevoPath) await this.storage.deleteFile(nuevoPath).catch(() => undefined);
      throw error;
    }
    if (nuevoPath) await this.storage.deleteFile(resultado.anteriorPath).catch(() => undefined);
    return { id: resultado.id };
  }
  async eliminar(actor: ActorMensual, id: string) {
    const empresaId = await this.autorizar(actor, "DOCUMENTO_MENSUAL_DELETE");
    const path = await db.transaction(async (tx) => {
      const anterior = await this.cargar(empresaId, id, tx, true);
      const ahora = new Date();
      const [doc] = await tx
        .update(documentoMensual)
        .set({ eliminadoEn: ahora, actualizadoEn: ahora })
        .where(eq(documentoMensual.id, id))
        .returning();
      await this.evento(tx, actor, doc, "ELIMINACION", anterior);
      return anterior.archivoPath;
    });
    await this.storage.deleteFile(path).catch(() => undefined);
    return { message: "Documento eliminado" };
  }
  async descargar(actor: ActorMensual, id: string, empresa?: string) {
    const empresaId = await this.autorizar(
      actor,
      "DOCUMENTO_MENSUAL_READ",
      empresa,
    );
    const doc = await this.cargar(empresaId, id);
    return {
      url: await this.storage.getPresignedUrl(
        doc.archivoPath,
        await this.permisos.getSegundosDescarga(empresaId),
      ),
      nombre: doc.archivoNombre,
    };
  }
  private async validarImagen(file: ArchivoMultipart, mime: string) {
    if (!mime.startsWith('image/')) return;
    try {
      const metadata = await sharp(file.buffer, {limitInputPixels: 20000000}).metadata();
      if (!metadata.width || !metadata.height || metadata.width * metadata.height > 20000000 || (metadata.pages ?? 1) !== 1)
        throw new Error('Límite de imagen');
    } catch { throw new BadRequestException('La imagen no es válida o supera 20 megapíxeles. Usa una foto de menor resolución.'); }
  }

  async descargarOriginal(actor: ActorMensual, id: string, empresa?: string) {
    const liberar = cupoDescargaOriginal.adquirir();
    try {
    const empresaId = await this.autorizar(actor, "DOCUMENTO_MENSUAL_READ", empresa);
    const doc = await this.cargar(empresaId, id);
    const stream = await this.storage.getObjectStream(doc.archivoPath);
    const timer = setTimeout(() => stream.destroy(new Error("Tiempo de lectura excedido")), 30000);
    const chunks: Buffer[] = []; let size = 0;
    try {
      for await (const chunk of stream) {
        size += chunk.length;
        if (size > 10 * 1024 * 1024 || size > doc.archivoBytes) throw new BadRequestException("Tamaño de archivo inesperado");
        chunks.push(Buffer.from(chunk));
      }
    } finally { clearTimeout(timer); stream.destroy(); }
    if (size !== doc.archivoBytes) throw new BadRequestException("El archivo original está incompleto");
    await this.autorizar(actor, "DOCUMENTO_MENSUAL_READ", empresa);
    const actual = await this.cargar(empresaId, id);
    if (actual.archivoPath !== doc.archivoPath) throw new BadRequestException('El archivo fue reemplazado durante la descarga. Intenta nuevamente.');
    return { bytes: Buffer.concat(chunks), nombre: doc.archivoNombre, mime: doc.archivoMime };
    } finally { liberar(); }
  }

  async actividad(actor: ActorMensual, empresa?: string) {
    const empresaId = await this.autorizar(
      actor,
      "DOCUMENTO_MENSUAL_READ",
      empresa,
    );
    const data = await db
      .select({
        id: eventoDocumentoMensual.id,
        documentoId: eventoDocumentoMensual.documentoId,
        accion: eventoDocumentoMensual.accion,
        antes: eventoDocumentoMensual.antes,
        despues: eventoDocumentoMensual.despues,
        fecha: eventoDocumentoMensual.fecha,
        autor: usuario.nombreCompleto,
      })
      .from(eventoDocumentoMensual)
      .leftJoin(usuario, eq(usuario.id, eventoDocumentoMensual.actorId))
      .where(eq(eventoDocumentoMensual.empresaId, empresaId))
      .orderBy(
        desc(eventoDocumentoMensual.fecha),
        desc(eventoDocumentoMensual.id),
      )
      .limit(100);
    return { data };
  }
  async documentosExport(
    actor: ActorMensual,
    anio: unknown,
    mes: unknown,
    categorias: unknown,
    empresa?: string,
  ) {
    const empresaId = await this.autorizar(
      actor,
      "DOCUMENTO_MENSUAL_EXPORT",
      empresa,
    );
    const p = periodo(anio, mes),
      tipos: Categoria[] = seleccion(categorias);
    const docs = await db
      .select()
      .from(documentoMensual)
      .where(
        and(
          eq(documentoMensual.empresaId, empresaId),
          eq(documentoMensual.anio, p.anio),
          eq(documentoMensual.mes, p.mes),
          inArray(documentoMensual.categoria, tipos),
          isNull(documentoMensual.eliminadoEn),
        ),
      )
      .orderBy(
        asc(documentoMensual.categoria),
        asc(documentoMensual.fechaCarga),
        asc(documentoMensual.id),
      )
      .limit(101);
    if (!docs.length)
      throw new BadRequestException("No hay documentos para esta selección");
    if (
      docs.length > 100 ||
      docs.reduce((sum, d) => sum + d.archivoBytes, 0) > 50 * 1024 * 1024
    )
      throw new BadRequestException(
        "La selección supera 100 archivos o 50 MB. Descarga menos categorías.",
      );
    return { docs, empresaId, ...p };
  }
  async revalidarExport(
    actor: ActorMensual,
    docs: Documento[],
    empresaId: string,
  ) {
    await this.autorizar(actor, "DOCUMENTO_MENSUAL_EXPORT", empresaId);
    const actuales = await db
      .select({
        id: documentoMensual.id,
        actualizadoEn: documentoMensual.actualizadoEn,
      })
      .from(documentoMensual)
      .where(
        and(
          eq(documentoMensual.empresaId, empresaId),
          inArray(
            documentoMensual.id,
            docs.map((d) => d.id),
          ),
          isNull(documentoMensual.eliminadoEn),
        ),
      );
    const fechas = new Map(
      actuales.map((d) => [d.id, d.actualizadoEn.getTime()]),
    );
    if (
      actuales.length !== docs.length ||
      docs.some((d) => fechas.get(d.id) !== d.actualizadoEn.getTime())
    )
      throw new BadRequestException(
        "Un documento cambió durante la descarga. Intenta nuevamente.",
      );
  }
}
