import { Injectable, ForbiddenException, NotFoundException, ConflictException } from '@nestjs/common';
import {
  db,
  factura,
  loteImportacion,
  documentoSustento,
  pagoFactura,
  relacionEmpresaContador,
} from '@audivare/database';
import { eq, and, inArray, sql, desc } from 'drizzle-orm';
import { PermisosService } from '../common/permisos/permisos.service';
import { NotificacionesService } from '../notificaciones/notificaciones.service';

/** Factura que NO se pudo eliminar por tener trabajo de la empresa (documentos/pagos). */
export interface FacturaConservada {
  id: string;
  serie: string | null;
  numero: string | null;
  documentos: number;
  pagos: number;
  motivo: string;
}

export interface ResultadoEliminacion {
  eliminadas: number;
  conservadas: FacturaConservada[];
}

export interface ImportacionResumen {
  id: string;
  nombre_archivo: string | null;
  creadas: number;
  facturas_vivas: number;
  fecha_creacion: Date;
  revertible: boolean;
}

/** Datos mínimos de una factura candidata a borrado. */
interface FacturaCandidata {
  id: string;
  serie: string | null;
  numero: string | null;
}

type Transaccion = Parameters<Parameters<typeof db.transaction>[0]>[0];

@Injectable()
export class EliminacionService {
  constructor(
    private readonly permisosService: PermisosService,
    private readonly notificacionesService: NotificacionesService,
  ) {}

  /** Solo el contador vinculado a una empresa activa opera sobre sus facturas. */
  private async verificarVinculo(userId: string, tipoUsuario: string, empresaId: string) {
    if (tipoUsuario !== 'CONTADOR_EXTERNO') {
      throw new ForbiddenException('Solo el contador externo puede eliminar facturas');
    }
    const rel = await db
      .select()
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

  /**
   * Clasifica facturas (que ya se confirmó pertenecen a la empresa) en:
   * - eliminables: sin documentos ni pagos (facturas "frescas"),
   * - conservadas: con documentos y/o pagos → NUNCA se borran (protege el
   *   trabajo de la empresa). Las observaciones no cuentan: son comentarios.
   */
  private async clasificar(
    candidatas: FacturaCandidata[],
    executor: typeof db | Transaccion = db,
  ): Promise<{ eliminables: FacturaCandidata[]; conservadas: FacturaConservada[] }> {
    if (candidatas.length === 0) {
      return { eliminables: [], conservadas: [] };
    }

    const ids = candidatas.map((c) => c.id);

    const docsRows = await executor
      .select({ facturaId: documentoSustento.facturaId, c: sql<number>`count(*)` })
      .from(documentoSustento)
      .where(inArray(documentoSustento.facturaId, ids))
      .groupBy(documentoSustento.facturaId);
    const docsPorFactura = new Map(docsRows.map((r) => [r.facturaId, Number(r.c)]));

    const pagosRows = await executor
      .select({ facturaId: pagoFactura.facturaId, c: sql<number>`count(*)` })
      .from(pagoFactura)
      .where(inArray(pagoFactura.facturaId, ids))
      .groupBy(pagoFactura.facturaId);
    const pagosPorFactura = new Map(pagosRows.map((r) => [r.facturaId, Number(r.c)]));

    const eliminables: FacturaCandidata[] = [];
    const conservadas: FacturaConservada[] = [];

    for (const f of candidatas) {
      const documentos = docsPorFactura.get(f.id) ?? 0;
      const pagos = pagosPorFactura.get(f.id) ?? 0;
      if (documentos === 0 && pagos === 0) {
        eliminables.push(f);
      } else {
        conservadas.push({
          id: f.id,
          serie: f.serie,
          numero: f.numero,
          documentos,
          pagos,
          motivo: this.motivoConservada(documentos, pagos),
        });
      }
    }

    return { eliminables, conservadas };
  }

  private motivoConservada(documentos: number, pagos: number): string {
    const partes: string[] = [];
    if (documentos > 0) partes.push(`${documentos} documento(s) cargado(s)`);
    if (pagos > 0) partes.push(`${pagos} pago(s) registrado(s)`);
    return `Tiene ${partes.join(' y ')} por parte de la empresa.`;
  }

  /**
   * Borra las facturas eliminables (en transacción; el cascade de la BD limpia
   * observaciones e historial, y como no tienen documentos ni pagos no hay
   * archivos en MinIO que huérfanar) y notifica a la empresa.
   */
  private async ejecutarBorrado(
    userId: string,
    empresaId: string,
    eliminables: FacturaCandidata[],
  ): Promise<number> {
    if (eliminables.length === 0) return 0;

    const ids = eliminables.map((f) => f.id);

    return db.transaction(async (tx) => {
      // Mismo bloqueo que pagos: no borrar una factura que recibió trabajo
      // mientras se confirmaba la selección. Orden estable para lotes concurrentes.
      const actuales = await tx.select({ id: factura.id, serie: factura.serie, numero: factura.numero })
        .from(factura)
        .where(and(eq(factura.empresaId, empresaId), inArray(factura.id, ids)))
        .orderBy(factura.id).for('update');
      const { conservadas } = await this.clasificar(actuales, tx);
      if (conservadas.length) {
        throw new ConflictException({
          message: 'Una factura recibió documentos o pagos durante la operación. Actualiza la lista e inténtalo nuevamente.',
          conservadas,
        });
      }
      if (!actuales.length) return 0;
      await tx.delete(factura).where(inArray(factura.id, actuales.map((f) => f.id)));

      const destinatarios = await this.permisosService.getUsuariosConPermiso(empresaId, 'FACTURA_READ');
      for (const destinatarioId of destinatarios) {
        await this.notificacionesService.crearNotificacion(
          destinatarioId,
          'FACTURAS_ELIMINADAS',
          'Facturas eliminadas',
          `El contador eliminó ${actuales.length} factura(s) importada(s).`,
          { empresa_id: empresaId, cantidad_eliminadas: actuales.length },
          tx,
        );
      }
      return actuales.length;
    }, { isolationLevel: 'read committed' });
  }

  /** Lista las importaciones recientes de la empresa (para deshacerlas). */
  async getImportaciones(userId: string, tipoUsuario: string, empresaId: string): Promise<{ data: ImportacionResumen[] }> {
    await this.verificarVinculo(userId, tipoUsuario, empresaId);

    const rows = await db
      .select({
        id: loteImportacion.id,
        nombreArchivo: loteImportacion.nombreArchivo,
        creadas: loteImportacion.creadas,
        revertidoEn: loteImportacion.revertidoEn,
        fechaCreacion: loteImportacion.fechaCreacion,
        facturasVivas: sql<number>`count(${factura.id})`,
      })
      .from(loteImportacion)
      .leftJoin(factura, eq(factura.loteImportacionId, loteImportacion.id))
      .where(eq(loteImportacion.empresaId, empresaId))
      .groupBy(loteImportacion.id)
      .orderBy(desc(loteImportacion.fechaCreacion))
      .limit(20);

    return {
      data: rows.map((r) => ({
        id: r.id,
        nombre_archivo: r.nombreArchivo,
        creadas: r.creadas,
        facturas_vivas: Number(r.facturasVivas),
        fecha_creacion: r.fechaCreacion,
        // Reversible si aún quedan facturas de ese lote y no fue revertido antes.
        revertible: r.revertidoEn === null && Number(r.facturasVivas) > 0,
      })),
    };
  }

  /** Elimina una factura suelta. Si tiene documentos/pagos, responde 409 con el detalle. */
  async eliminarFactura(userId: string, tipoUsuario: string, empresaId: string, facturaId: string): Promise<ResultadoEliminacion> {
    await this.verificarVinculo(userId, tipoUsuario, empresaId);

    const rows = await db
      .select({ id: factura.id, serie: factura.serie, numero: factura.numero })
      .from(factura)
      .where(and(eq(factura.id, facturaId), eq(factura.empresaId, empresaId)));

    if (!rows.length) {
      throw new NotFoundException('Factura no encontrada en esta empresa');
    }

    const { eliminables, conservadas } = await this.clasificar(rows);

    if (conservadas.length) {
      const c = conservadas[0];
      throw new ConflictException({
        message: `La factura ${c.serie}-${c.numero} no se puede eliminar. ${c.motivo}`,
        factura: c,
      });
    }

    const eliminadas = await this.ejecutarBorrado(userId, empresaId, eliminables);
    return { eliminadas, conservadas };
  }

  /** Elimina las facturas seleccionadas. Borra las libres y conserva (informando) las que tengan trabajo. */
  async eliminarFacturas(userId: string, tipoUsuario: string, empresaId: string, ids: string[]): Promise<ResultadoEliminacion> {
    await this.verificarVinculo(userId, tipoUsuario, empresaId);

    const idsUnicos = Array.from(new Set(ids.filter((id) => typeof id === 'string' && id.length > 0)));
    if (idsUnicos.length === 0) {
      return { eliminadas: 0, conservadas: [] };
    }

    // Aislamiento multi-tenant: solo se consideran facturas de esta empresa.
    const rows = await db
      .select({ id: factura.id, serie: factura.serie, numero: factura.numero })
      .from(factura)
      .where(and(eq(factura.empresaId, empresaId), inArray(factura.id, idsUnicos)));

    const { eliminables, conservadas } = await this.clasificar(rows);
    const eliminadas = await this.ejecutarBorrado(userId, empresaId, eliminables);
    return { eliminadas, conservadas };
  }

  /** Deshace una importación: borra las facturas del lote (conservando las que tengan trabajo). */
  async deshacerLote(userId: string, tipoUsuario: string, empresaId: string, loteId: string): Promise<ResultadoEliminacion> {
    await this.verificarVinculo(userId, tipoUsuario, empresaId);

    const lotes = await db
      .select({ id: loteImportacion.id })
      .from(loteImportacion)
      .where(and(eq(loteImportacion.id, loteId), eq(loteImportacion.empresaId, empresaId)));

    if (!lotes.length) {
      throw new NotFoundException('Importación no encontrada en esta empresa');
    }

    const rows = await db
      .select({ id: factura.id, serie: factura.serie, numero: factura.numero })
      .from(factura)
      .where(and(eq(factura.empresaId, empresaId), eq(factura.loteImportacionId, loteId)));

    const { eliminables, conservadas } = await this.clasificar(rows);
    const eliminadas = await this.ejecutarBorrado(userId, empresaId, eliminables);

    // Si ya no queda ninguna factura del lote, se marca como revertido (auditoría).
    if (conservadas.length === 0) {
      await db.update(loteImportacion)
        .set({ revertidoEn: new Date() })
        .where(eq(loteImportacion.id, loteId));
    }

    return { eliminadas, conservadas };
  }
}
