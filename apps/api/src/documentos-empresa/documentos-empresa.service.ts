import { Injectable, ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { db, documentoEmpresa, relacionEmpresaContador, mensajeDocumentoEmpresa, usuario } from '@audivare/database';
import { eq, and, desc } from 'drizzle-orm';
import { PermisosService } from '../common/permisos/permisos.service';
import { StorageService } from '../storage/storage.service';
import { NotificacionesService } from '../notificaciones/notificaciones.service';
import { ArchivoMultipart } from '../common/multipart.util';
import { validarAdjunto } from '../common/archivo-adjunto.util';
import { revisarPdf } from '../storage/analisis-archivos.service';
import sharp from 'sharp';

export interface DatosDocumentoEmpresa {
  titulo: string;
  descripcion?: string;
  anio?: number | null;
  mes?: number | null;
}

/** Normaliza/valida año y mes (opcionales). Lanza 400 si vienen fuera de rango. */
function normalizarPeriodo(anio?: number | null, mes?: number | null): { anio: number | null; mes: number | null } {
  let a: number | null = null;
  let m: number | null = null;
  if (anio !== undefined && anio !== null && !Number.isNaN(anio)) {
    if (!Number.isInteger(anio) || anio < 2000 || anio > 2100) {
      throw new BadRequestException('El año no es válido');
    }
    a = anio;
  }
  if (mes !== undefined && mes !== null && !Number.isNaN(mes)) {
    if (!Number.isInteger(mes) || mes < 1 || mes > 12) {
      throw new BadRequestException('El mes no es válido');
    }
    m = mes;
  }
  // El mes sin año no tiene sentido para filtrar.
  if (m !== null && a === null) {
    throw new BadRequestException('Para indicar el mes también debes indicar el año');
  }
  return { anio: a, mes: m };
}

@Injectable()
export class DocumentosEmpresaService {
  private async validarArchivo(file: ArchivoMultipart) {
    const {mimetype} = validarAdjunto(file);
    if (mimetype === 'application/pdf' && await revisarPdf(file.buffer) !== 'ACEPTADO')
      throw new BadRequestException('El PDF está dañado, protegido o contiene acciones no admitidas.');
    if (mimetype.startsWith('image/')) {
      try {
        const m = await sharp(file.buffer, {limitInputPixels:20000000}).metadata();
        if (!m.width || !m.height || m.width*m.height > 20000000 || (m.pages ?? 1) !== 1) throw new Error();
      } catch { throw new BadRequestException('Imagen inválida o superior a 20 megapíxeles.'); }
    }
  }
  constructor(
    private readonly permisosService: PermisosService,
    private readonly storageService: StorageService,
    private readonly notificacionesService: NotificacionesService,
  ) {}

  /** Verifica que el contador esté vinculado a la empresa activa. */
  private async verificarContador(userId: string, tipoUsuario: string, empresaId: string) {
    if (tipoUsuario !== 'CONTADOR_EXTERNO') {
      throw new ForbiddenException('Solo el contador externo puede acceder a esta ruta');
    }
    const rel = await db
      .select({ contadorId: relacionEmpresaContador.contadorId })
      .from(relacionEmpresaContador)
      .where(and(
        eq(relacionEmpresaContador.empresaId, empresaId),
        eq(relacionEmpresaContador.contadorId, userId),
      ));
    if (!rel.length) {
      throw new ForbiddenException('No estás vinculado a esta empresa');
    }
    await this.permisosService.checkEmpresaActiva(empresaId);
  }

  /** Listado de documentos de una empresa, con filtro opcional por año/mes. */
  private async listar(empresaId: string, anio?: string, mes?: string) {
    const filtros = [eq(documentoEmpresa.empresaId, empresaId)];
    if (anio) {
      const a = Number(anio);
      if (Number.isInteger(a)) filtros.push(eq(documentoEmpresa.anio, a));
    }
    if (mes) {
      const m = Number(mes);
      if (Number.isInteger(m)) filtros.push(eq(documentoEmpresa.mes, m));
    }
    const docs = await db
      .select()
      .from(documentoEmpresa)
      .where(and(...filtros))
      .orderBy(desc(documentoEmpresa.fechaSubida));
    return { data: docs };
  }

  // ---- Empresa (usuario interno con DOCUMENTO_EMPRESA_MANAGE) ----

  async listarEmpresa(userId: string, anio?: string, mes?: string) {
    const empresaId = await this.permisosService.getEmpresaId(userId);
    return this.listar(empresaId, anio, mes);
  }

  async subir(userId: string, file: ArchivoMultipart, datos: DatosDocumentoEmpresa) {
    const empresaId = await this.permisosService.getEmpresaId(userId);
    if (!file || !file.buffer?.length) {
      throw new BadRequestException('El archivo es obligatorio');
    }
    const titulo = datos.titulo?.trim();
    if (!titulo) {
      throw new BadRequestException('El título del documento es obligatorio');
    }
    const { anio, mes } = normalizarPeriodo(datos.anio, datos.mes);

    await this.validarArchivo(file);
    const storagePath = await this.storageService.uploadFile(file, `empresa/${empresaId}/documentos`);

    const inserted = await db.insert(documentoEmpresa).values({
      empresaId,
      titulo,
      descripcion: datos.descripcion?.trim() || null,
      anio,
      mes,
      archivoStoragePath: storagePath,
      archivoNombreOriginal: file.filename,
      subidoPor: userId,
    }).returning();

    // Aviso a los contadores vinculados: hay un documento de empresa nuevo.
    const contadores = await this.getContadoresDeEmpresa(empresaId);
    for (const contadorId of contadores) {
      await this.notificacionesService.crearNotificacion(
        contadorId,
        'DOCUMENTO_EMPRESA_CARGADO',
        'Documento de empresa cargado',
        `La empresa cargó el documento "${titulo}".`,
        { empresa_id: empresaId, documento_id: inserted[0].id, documento_titulo: titulo },
      );
    }

    return inserted[0];
  }

  async reemplazar(userId: string, documentoId: string, file: ArchivoMultipart) {
    const empresaId = await this.permisosService.getEmpresaId(userId);
    const doc = await this.cargarDeEmpresa(empresaId, documentoId);
    if (!file || !file.buffer?.length) {
      throw new BadRequestException('El archivo es obligatorio');
    }

    const pathAnterior = doc.archivoStoragePath;
    // Se sube el nuevo primero; solo si tiene éxito se borra el anterior.
    await this.validarArchivo(file);
    const nuevoPath = await this.storageService.uploadFile(file, `empresa/${empresaId}/documentos`);

    const updated = await db
      .update(documentoEmpresa)
      .set({
        archivoStoragePath: nuevoPath,
        archivoNombreOriginal: file.filename,
        subidoPor: userId,
        fechaSubida: new Date(),
      })
      .where(eq(documentoEmpresa.id, documentoId))
      .returning();

    if (pathAnterior && pathAnterior !== nuevoPath) {
      try {
        await this.storageService.deleteFile(pathAnterior);
      } catch {
        // Si falla, queda un huérfano recuperable; no bloquea la operación.
      }
    }

    return updated[0];
  }

  async actualizarDatos(userId: string, documentoId: string, datos: DatosDocumentoEmpresa) {
    const empresaId = await this.permisosService.getEmpresaId(userId);
    await this.cargarDeEmpresa(empresaId, documentoId);
    const titulo = datos.titulo?.trim();
    if (!titulo) {
      throw new BadRequestException('El título del documento es obligatorio');
    }
    const { anio, mes } = normalizarPeriodo(datos.anio, datos.mes);

    const updated = await db
      .update(documentoEmpresa)
      .set({
        titulo,
        descripcion: datos.descripcion?.trim() || null,
        anio,
        mes,
      })
      .where(eq(documentoEmpresa.id, documentoId))
      .returning();

    return updated[0];
  }

  async eliminar(userId: string, documentoId: string) {
    const empresaId = await this.permisosService.getEmpresaId(userId);
    await this.cargarDeEmpresa(empresaId, documentoId);

    const [retirado] = await db.delete(documentoEmpresa)
      .where(and(eq(documentoEmpresa.id, documentoId), eq(documentoEmpresa.empresaId, empresaId)))
      .returning({ path: documentoEmpresa.archivoStoragePath });
    if (retirado?.path) {
      try {
        await this.storageService.deleteFile(retirado.path);
      } catch {
        // La fila ya está retirada; StorageService registra la limpieza fallida.
      }
    }
    return { mensaje: 'Documento eliminado' };
  }

  async getDownloadUrlEmpresa(userId: string, documentoId: string) {
    const empresaId = await this.permisosService.getEmpresaId(userId);
    const doc = await this.cargarDeEmpresa(empresaId, documentoId);
    const url = await this.storageService.getPresignedUrl(doc.archivoStoragePath, await this.permisosService.getSegundosDescarga(empresaId));
    return { url, nombre: doc.archivoNombreOriginal };
  }

  // ---- Contador (solo lectura, por vínculo) ----

  async listarContador(userId: string, tipoUsuario: string, empresaId: string, anio?: string, mes?: string) {
    await this.verificarContador(userId, tipoUsuario, empresaId);
    return this.listar(empresaId, anio, mes);
  }

  async getDownloadUrlContador(userId: string, tipoUsuario: string, empresaId: string, documentoId: string) {
    await this.verificarContador(userId, tipoUsuario, empresaId);
    const doc = await this.cargarDeEmpresa(empresaId, documentoId);
    const url = await this.storageService.getPresignedUrl(doc.archivoStoragePath, await this.permisosService.getSegundosDescarga(empresaId));
    return { url, nombre: doc.archivoNombreOriginal };
  }

  // ---- Conversación (solicitudes/mensajes contador↔empresa) ----

  /** Lista el hilo de mensajes de la empresa, con el nombre del autor. */
  private async listarMensajes(empresaId: string) {
    const rows = await db
      .select({
        id: mensajeDocumentoEmpresa.id,
        contenido: mensajeDocumentoEmpresa.contenido,
        de_contador: mensajeDocumentoEmpresa.deContador,
        fecha_creacion: mensajeDocumentoEmpresa.fechaCreacion,
        autor_nombre: usuario.nombreCompleto,
      })
      .from(mensajeDocumentoEmpresa)
      .leftJoin(usuario, eq(usuario.id, mensajeDocumentoEmpresa.autorId))
      .where(eq(mensajeDocumentoEmpresa.empresaId, empresaId))
      .orderBy(mensajeDocumentoEmpresa.fechaCreacion);
    return { data: rows };
  }

  private resumenMensaje(texto: string): string {
    const t = texto.trim();
    return t.length > 120 ? `${t.slice(0, 119)}…` : t;
  }

  // Empresa (usuario interno con DOCUMENTO_EMPRESA_MANAGE)
  async getMensajesEmpresa(userId: string) {
    const empresaId = await this.permisosService.getEmpresaId(userId);
    return this.listarMensajes(empresaId);
  }

  async crearMensajeEmpresa(userId: string, contenido: string) {
    const empresaId = await this.permisosService.getEmpresaId(userId);
    const texto = contenido?.trim();
    if (!texto) throw new BadRequestException('El mensaje no puede estar vacío');

    return await db.transaction(async (tx) => {
      const inserted = await tx.insert(mensajeDocumentoEmpresa).values({
        empresaId, autorId: userId, deContador: false, contenido: texto,
      }).returning();

      // Aviso a los contadores vinculados.
      const contadores = await this.getContadoresDeEmpresa(empresaId);
      for (const contadorId of contadores) {
        await this.notificacionesService.crearNotificacion(
          contadorId,
          'MENSAJE_DOC_EMPRESA',
          'Mensaje sobre documentos de la empresa',
          `La empresa respondió: ${this.resumenMensaje(texto)}`,
          { empresa_id: empresaId, mensaje_resumen: this.resumenMensaje(texto) },
          tx,
        );
      }
      return inserted[0];
    });
  }

  // Contador (por vínculo)
  async getMensajesContador(userId: string, tipoUsuario: string, empresaId: string) {
    await this.verificarContador(userId, tipoUsuario, empresaId);
    return this.listarMensajes(empresaId);
  }

  async crearMensajeContador(userId: string, tipoUsuario: string, empresaId: string, contenido: string) {
    await this.verificarContador(userId, tipoUsuario, empresaId);
    const texto = contenido?.trim();
    if (!texto) throw new BadRequestException('El mensaje no puede estar vacío');

    return await db.transaction(async (tx) => {
      const inserted = await tx.insert(mensajeDocumentoEmpresa).values({
        empresaId, autorId: userId, deContador: true, contenido: texto,
      }).returning();

      // Aviso a los internos que gestionan los documentos de la empresa.
      const internos = await this.permisosService.getUsuariosConPermiso(empresaId, 'DOCUMENTO_EMPRESA_MANAGE');
      for (const internoId of internos) {
        await this.notificacionesService.crearNotificacion(
          internoId,
          'MENSAJE_DOC_EMPRESA',
          'Solicitud del contador',
          `El contador escribió: ${this.resumenMensaje(texto)}`,
          { empresa_id: empresaId, mensaje_resumen: this.resumenMensaje(texto) },
          tx,
        );
      }
      return inserted[0];
    });
  }

  // ---- Helpers ----

  /** Carga un documento asegurando que pertenece a la empresa (aislamiento multi-tenant). */
  private async cargarDeEmpresa(empresaId: string, documentoId: string) {
    const rows = await db
      .select()
      .from(documentoEmpresa)
      .where(and(eq(documentoEmpresa.id, documentoId), eq(documentoEmpresa.empresaId, empresaId)));
    if (!rows.length) {
      throw new NotFoundException('Documento no encontrado');
    }
    return rows[0];
  }

  /** IDs de los contadores externos vinculados a la empresa. */
  private async getContadoresDeEmpresa(empresaId: string): Promise<string[]> {
    const rels = await db
      .select({ contadorId: relacionEmpresaContador.contadorId })
      .from(relacionEmpresaContador)
      .where(eq(relacionEmpresaContador.empresaId, empresaId));
    return rels.map((r) => r.contadorId);
  }
}
