import {
  Injectable,
  ForbiddenException,
  BadRequestException,
  Logger,
  StreamableFile,
} from '@nestjs/common';
import {
  db,
  relacionEmpresaContador,
  empresa,
  factura,
  documentoSustento,
  pagoFactura,
} from '@audivare/database';
import { eq, and, or, desc, ilike, gte, lt, inArray } from 'drizzle-orm';
import * as ExcelJS from 'exceljs';
import { Readable, PassThrough } from 'stream';
import { StorageService } from '../storage/storage.service';
import { PermisosService } from '../common/permisos/permisos.service';
import { LIMITES_TRABAJO, cupoExportacion, controlarFrecuenciaTrabajo } from '../common/limites-trabajo';

export interface ExportFilters {
  estado?: string;
  proveedor?: string;
  anio?: string;
  mes?: string;
  facturaId?: string;
}

interface FacturaExport {
  id: string;
  serie: string | null;
  numero: string | null;
  proveedorRuc: string | null;
  proveedorNombre: string | null;
  moneda: string;
  fechaEmision: string | null;
  montoTotal: string | number | null;
  saldoPendiente: string | number | null;
  estadoFactura: string | null;
  documentacionEstado: string | null;
}

interface DocExport {
  facturaId: string;
  id: string;
  tipoDocumento: string;
  descripcion: string | null;
  archivoStoragePath: string;
  archivoNombreOriginal: string;
}

interface PagoExport {
  facturaId: string;
  id: string;
  montoPagado: string;
  comprobantePath: string | null;
  comprobanteNombre: string | null;
}

// Catálogo de documentos con su etiqueta legible, para las columnas Sí/No del Excel.
const TIPOS_DOC_CATALOGO: Array<{ tipo: string; etiqueta: string }> = [
  { tipo: 'GUIA_REMISION_REMITENTE', etiqueta: 'Guía de remisión remitente' },
  { tipo: 'GUIA_REMISION_TRANSPORTISTA', etiqueta: 'Guía de remisión transportista' },
  { tipo: 'COTIZACION', etiqueta: 'Cotización o proforma' },
  { tipo: 'CONTRATO', etiqueta: 'Contrato' },
];

const MESES_ES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

@Injectable()
export class ExportContadorService {
  private readonly logger = new Logger(ExportContadorService.name);

  constructor(
    private readonly storageService: StorageService,
    private readonly permisosService: PermisosService,
  ) {}

  private async verificarVinculo(
    userId: string,
    tipoUsuario: string,
    empresaId: string,
  ): Promise<void> {
    if (tipoUsuario !== 'CONTADOR_EXTERNO') {
      throw new ForbiddenException('Solo contadores externos pueden acceder a esta ruta');
    }
    const relacion = await db
      .select()
      .from(relacionEmpresaContador)
      .where(
        and(
          eq(relacionEmpresaContador.empresaId, empresaId),
          eq(relacionEmpresaContador.contadorId, userId),
        ),
      );

    if (!relacion.length) {
      throw new ForbiddenException('No estás vinculado a esta empresa');
    }

    await this.permisosService.checkEmpresaActiva(empresaId);
  }

  /** Nombre de carpeta seguro para el sistema de archivos. */
  private slug(texto: string | null | undefined, fallback = 'SIN_DATO'): string {
    const limpio = (texto || '').replace(/[^a-zA-Z0-9\-_. ]/g, '_').trim();
    return limpio || fallback;
  }

  /** Rango [desde, hasta) por año (obligatorio salvo export de una sola factura) y mes opcional. */
  private rango(filters: ExportFilters): { desde: string; hasta: string } | null {
    if (filters.facturaId) return null; // export de una factura puntual: sin rango
    if (!filters.anio) {
      throw new BadRequestException('Debes seleccionar el año que deseas exportar');
    }
    const y = Number(filters.anio);
    if (!Number.isInteger(y) || y < 2000 || y > 2100) {
      throw new BadRequestException('El año a exportar no es válido');
    }
    if (filters.mes) {
      const m = Number(filters.mes);
      if (!Number.isInteger(m) || m < 1 || m > 12) {
        throw new BadRequestException('El mes a exportar no es válido');
      }
      const mm = String(m).padStart(2, '0');
      const hasta = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
      return { desde: `${y}-${mm}-01`, hasta };
    }
    return { desde: `${y}-01-01`, hasta: `${y + 1}-01-01` };
  }

  private buildConditions(empresaId: string, filters: ExportFilters) {
    const conditions = [eq(factura.empresaId, empresaId)];
    if (filters.estado && filters.estado !== 'TODOS') {
      conditions.push(eq(factura.estadoFactura, filters.estado as never));
    }
    if (filters.proveedor) {
      conditions.push(
        or(
          ilike(factura.proveedorNombre, `%${filters.proveedor}%`),
          ilike(factura.proveedorRuc, `%${filters.proveedor}%`),
        ) as never,
      );
    }
    const r = this.rango(filters);
    if (r) {
      conditions.push(gte(factura.fechaEmision, r.desde) as never);
      conditions.push(lt(factura.fechaEmision, r.hasta) as never);
    }
    if (filters.facturaId) {
      conditions.push(eq(factura.id, filters.facturaId) as never);
    }
    return conditions;
  }

  private async getEmpresaNombre(empresaId: string): Promise<string> {
    const rows = await db
      .select({ razonSocial: empresa.razonSocial })
      .from(empresa)
      .where(eq(empresa.id, empresaId));
    return rows[0]?.razonSocial ?? 'Empresa';
  }

  private async getFacturas(empresaId: string, filters: ExportFilters): Promise<FacturaExport[]> {
    const conditions = this.buildConditions(empresaId, filters);
    const rows = await db
      .select({
        id: factura.id,
        serie: factura.serie,
        numero: factura.numero,
        proveedorRuc: factura.proveedorRuc,
        proveedorNombre: factura.proveedorNombre,
        moneda: factura.moneda,
        fechaEmision: factura.fechaEmision,
        montoTotal: factura.montoTotal,
        saldoPendiente: factura.saldoPendiente,
        estadoFactura: factura.estadoFactura,
        documentacionEstado: factura.documentacionEstado,
      })
      .from(factura)
      .where(and(...conditions))
      .orderBy(desc(factura.fechaEmision), desc(factura.id)).limit(LIMITES_TRABAJO.filas + 1);
    if (rows.length > LIMITES_TRABAJO.filas) throw new BadRequestException('Máximo 5000 facturas por exportación. Selecciona un mes o proveedor.');
    return rows;
  }

  private async getDocs(facturaIds: string[]): Promise<DocExport[]> {
    if (!facturaIds.length) return [];
    const rows = await db
        .select({
          facturaId: documentoSustento.facturaId,
          id: documentoSustento.id,
          tipoDocumento: documentoSustento.tipoDocumento,
          descripcion: documentoSustento.descripcion,
          archivoStoragePath: documentoSustento.archivoStoragePath,
          archivoNombreOriginal: documentoSustento.archivoNombreOriginal,
        })
        .from(documentoSustento)
        .where(inArray(documentoSustento.facturaId, facturaIds)).limit(LIMITES_TRABAJO.documentosExport + 1);
    if (rows.length > LIMITES_TRABAJO.documentosExport) throw new BadRequestException('Demasiados documentos. Reduce el periodo exportado.');
    return rows;
  }

  private async getPagos(facturaIds: string[]): Promise<PagoExport[]> {
    if (!facturaIds.length) return [];
    const rows = await db
        .select({
          facturaId: pagoFactura.facturaId,
          id: pagoFactura.id,
          montoPagado: pagoFactura.montoPagado,
          comprobantePath: pagoFactura.comprobantePath,
          comprobanteNombre: pagoFactura.comprobanteNombre,
        })
        .from(pagoFactura)
        .where(inArray(pagoFactura.facturaId, facturaIds)).limit(LIMITES_TRABAJO.documentosExport + 1);
    if (rows.length > LIMITES_TRABAJO.documentosExport) throw new BadRequestException('Demasiados pagos. Reduce el periodo exportado.');
    return rows;
  }

  private estadoLabel(estado: string | null): string {
    const map: Record<string, string> = { ACTIVA: 'Activa', PAGADA: 'Pagada' };
    return estado ? (map[estado] ?? estado) : '';
  }

  private mesNombre(fechaEmision: string | null): string {
    if (!fechaEmision) return 'Sin fecha';
    const m = Number(fechaEmision.substring(5, 7));
    return MESES_ES[m - 1] ?? 'Sin fecha';
  }

  private monedaFmt(moneda: string): string {
    return moneda === 'USD' ? '"US$ "#,##0.00' : '"S/ "#,##0.00';
  }

  private aplicarEstiloCabecera(sheet: ExcelJS.Worksheet): void {
    const headerRow = sheet.getRow(1);
    headerRow.height = 28;
    headerRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FF1E40AF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDBEAFE' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = { bottom: { style: 'thin', color: { argb: 'FF93C5FD' } } };
    });
  }

  private zebra(row: ExcelJS.Row): void {
    if (row.number % 2 === 0) {
      row.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
      });
    }
  }

  /**
   * Excel con una hoja "Facturas": una fila por factura, con columnas Sí/No por
   * cada tipo de documento del catálogo y una columna "Otros" con el texto libre.
   */
  async buildExcelBuffer(facturas: FacturaExport[], docs: DocExport[]): Promise<Buffer> {
    // Índice de documentos por factura.
    const docsPorFactura = new Map<string, DocExport[]>();
    for (const d of docs) {
      const list = docsPorFactura.get(d.facturaId) ?? [];
      list.push(d);
      docsPorFactura.set(d.facturaId, list);
    }

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'AudiVare';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Facturas');
    sheet.columns = [
      { header: 'Serie', key: 'serie', width: 10 },
      { header: 'Número', key: 'numero', width: 14 },
      { header: 'Fecha Emisión', key: 'fechaEmision', width: 15 },
      { header: 'RUC Proveedor', key: 'proveedorRuc', width: 16 },
      { header: 'Proveedor', key: 'proveedorNombre', width: 34 },
      { header: 'Moneda', key: 'moneda', width: 9 },
      { header: 'Total', key: 'montoTotal', width: 15 },
      { header: 'Saldo Pendiente', key: 'saldoPendiente', width: 16 },
      { header: 'Estado', key: 'estado', width: 12 },
      ...TIPOS_DOC_CATALOGO.map((t) => ({ header: t.etiqueta, key: t.tipo, width: 18 })),
      { header: 'Otros', key: 'otros', width: 30 },
      { header: 'Documentación', key: 'documentacion', width: 16 },
    ];
    this.aplicarEstiloCabecera(sheet);

    for (const f of facturas) {
      const misDocs = docsPorFactura.get(f.id) ?? [];
      const tiposPresentes = new Set(misDocs.map((d) => d.tipoDocumento));
      const otros = misDocs
        .filter((d) => d.tipoDocumento === 'OTROS')
        .map((d) => d.descripcion?.trim() || 'Otro documento')
        .join(', ');

      const rowData: Record<string, string | number> = {
        serie: f.serie ?? '',
        numero: f.numero ?? '',
        fechaEmision: f.fechaEmision ? new Date(f.fechaEmision).toLocaleDateString('es-PE') : '',
        proveedorRuc: f.proveedorRuc ?? '',
        proveedorNombre: f.proveedorNombre ?? '',
        moneda: f.moneda,
        montoTotal: f.montoTotal !== null ? Number(f.montoTotal) : '',
        saldoPendiente: f.saldoPendiente !== null ? Number(f.saldoPendiente) : '',
        estado: this.estadoLabel(f.estadoFactura),
        otros: otros || '',
        documentacion: f.documentacionEstado === 'COMPLETA' ? 'Completa' : 'Pendiente',
      };
      for (const t of TIPOS_DOC_CATALOGO) {
        rowData[t.tipo] = tiposPresentes.has(t.tipo) ? 'Sí' : 'No';
      }

      const row = sheet.addRow(rowData);
      const fmt = this.monedaFmt(f.moneda);
      row.getCell('montoTotal').numFmt = fmt;
      row.getCell('saldoPendiente').numFmt = fmt;
      // Resaltar "Sí" en verde y "No" en gris, para lectura rápida.
      for (const t of TIPOS_DOC_CATALOGO) {
        const cell = row.getCell(t.tipo);
        cell.alignment = { horizontal: 'center' };
        cell.font = { color: { argb: cell.value === 'Sí' ? 'FF16A34A' : 'FF9CA3AF' } };
      }
      this.zebra(row);
    }

    const raw = await workbook.xlsx.writeBuffer();
    return Buffer.from(raw);
  }

  async generarExcel(
    userId: string,
    tipoUsuario: string,
    empresaId: string,
    filters: ExportFilters,
  ): Promise<StreamableFile> {
    await this.verificarVinculo(userId, tipoUsuario, empresaId);
    return this.generarExcelEmpresa(empresaId, filters);
  }

  /** Genera el Excel para una empresa ya autorizada (el control de acceso lo hace el llamador). */
  async generarExcelEmpresa(empresaId: string, filters: ExportFilters): Promise<StreamableFile> {
    controlarFrecuenciaTrabajo('exportacion', empresaId);
    const liberar = cupoExportacion.adquirir();
    try { return await this.generarExcelLimitado(empresaId, filters); }
    finally { liberar(); }
  }

  private async generarExcelLimitado(empresaId: string, filters: ExportFilters): Promise<StreamableFile> {
    const facturas = await this.getFacturas(empresaId, filters);
    const docs = await this.getDocs(facturas.map((f) => f.id));

    const buffer = await this.buildExcelBuffer(facturas, docs);
    const stream = Readable.from(buffer);

    return new StreamableFile(stream, {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      disposition: `attachment; filename="facturas_${Date.now()}.xlsx"`,
    });
  }

  async generarZip(
    userId: string,
    tipoUsuario: string,
    empresaId: string,
    filters: ExportFilters,
  ): Promise<StreamableFile> {
    await this.verificarVinculo(userId, tipoUsuario, empresaId);
    return this.generarZipEmpresa(empresaId, filters);
  }

  /**
   * ZIP con estructura: <Empresa>-<Año>/<Mes>/<Serie>-<Número>/(documentos + pagos/).
   * El resumen.xlsx queda en la raíz. La organización por mes usa la fecha de emisión.
   */
  async generarZipEmpresa(empresaId: string, filters: ExportFilters): Promise<StreamableFile> {
    controlarFrecuenciaTrabajo('exportacion', empresaId);
    const liberar = cupoExportacion.adquirir();
    try {
      const resultado = await this.generarZipLimitado(empresaId, filters);
      resultado.getStream().once('close', liberar);
      return resultado;
    } catch (error) { liberar(); throw error; }
  }

  private async generarZipLimitado(empresaId: string, filters: ExportFilters): Promise<StreamableFile> {
    const empresaNombre = await this.getEmpresaNombre(empresaId);
    const facturas = await this.getFacturas(empresaId, filters);
    const facturaIds = facturas.map((f) => f.id);
    const docs = await this.getDocs(facturaIds);
    const pagos = await this.getPagos(facturaIds);
    const paths = [...docs.map(d => d.archivoStoragePath), ...pagos.map(p => p.comprobantePath)].filter((p): p is string => !!p);
    if (paths.length > LIMITES_TRABAJO.archivosZip) throw new BadRequestException('Máximo 200 archivos por ZIP. Reduce el periodo exportado.');
    let bytesDeclarados = 0;
    for (const path of paths) {
      const size = await this.storageService.getObjectSize(path);
      if (!Number.isSafeInteger(size) || size < 0 || size > LIMITES_TRABAJO.archivo) throw new BadRequestException('Un archivo supera el tamaño permitido para exportación');
      bytesDeclarados += size;
      if (bytesDeclarados > LIMITES_TRABAJO.bytesZip) throw new BadRequestException('Máximo 100 MB de archivos por ZIP. Reduce el periodo exportado.');
    }

    const anioLabel = filters.anio ?? new Date().getFullYear().toString();
    const raiz = `${this.slug(empresaNombre, 'Empresa')}-${anioLabel}`;

    const excelBuf = await this.buildExcelBuffer(facturas, docs);
    const passThrough = new PassThrough();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { ZipArchive } = require('archiver') as typeof import('archiver');
    const archive = new ZipArchive({ zlib: { level: 6 } });
    archive.pipe(passThrough);
    archive.on('error', () => passThrough.destroy(new Error('No se pudo completar la exportación')));
    passThrough.on('error', () => this.logger.warn('Exportación ZIP interrumpida; revisar identificador de solicitud'));
    const timer = setTimeout(() => passThrough.destroy(new Error('La exportación superó el tiempo permitido')), 120000);
    passThrough.on('close', () => { clearTimeout(timer); archive.abort(); });
    let bytesLeidos = 0;
    const storage = this.storageService;
    const archivoLimitado = (path: string) => Readable.from((async function* () {
      const source = await storage.getObjectStream(path);
      let bytesArchivo = 0;
      const cancelar = () => source.destroy();
      passThrough.once('close', cancelar);
      try {
        if (passThrough.destroyed) throw new Error('Exportación cancelada');
        for await (const chunk of source) {
          if (passThrough.destroyed) throw new Error('Exportación cancelada');
          bytesArchivo += chunk.length; bytesLeidos += chunk.length;
          if (bytesArchivo > LIMITES_TRABAJO.archivo || bytesLeidos > LIMITES_TRABAJO.bytesZip) throw new Error('Exportación supera el límite de bytes');
          yield chunk;
        }
      } finally { passThrough.off('close', cancelar); source.destroy(); }
    })());

    // Resumen Excel en la raíz.
    archive.append(Readable.from(excelBuf), { name: `${raiz}/resumen.xlsx` });

    const facturaMap = new Map(facturas.map((f) => [f.id, f]));

    // Carpeta base de cada factura: <raiz>/<Mes>/<Serie>-<Número>/
    const carpetaFactura = (f: FacturaExport): string => {
      const mes = this.mesNombre(f.fechaEmision);
      const sn = `${this.slug(f.serie, 'S')}-${this.slug(f.numero, 'N')}`;
      return `${raiz}/${mes}/${sn}`;
    };

    // Documentos de respaldo.
    for (const doc of docs) {
      if (!doc.archivoStoragePath) continue;
      const f = facturaMap.get(doc.facturaId);
      if (!f) continue;
      const ext = doc.archivoStoragePath.includes('.') ? doc.archivoStoragePath.split('.').pop() : 'bin';
      const tipoLabel = doc.tipoDocumento.toLowerCase().replace(/_/g, '-');
      const archiveName = `${carpetaFactura(f)}/${tipoLabel}_${doc.id.substring(0, 8)}.${ext}`;
      const stream = archivoLimitado(doc.archivoStoragePath);
      stream.on('error', () => passThrough.destroy(new Error('No se pudo completar la exportación')));
      archive.append(stream, { name: archiveName });
    }

    // Comprobantes de pago en la subcarpeta pagos/.
    for (const pago of pagos) {
      if (!pago.comprobantePath) continue;
      const f = facturaMap.get(pago.facturaId);
      if (!f) continue;
      const ext = pago.comprobantePath.includes('.') ? pago.comprobantePath.split('.').pop() : 'bin';
      const archiveName = `${carpetaFactura(f)}/pagos/comprobante_${pago.id.substring(0, 8)}.${ext}`;
      const stream = archivoLimitado(pago.comprobantePath);
      stream.on('error', () => passThrough.destroy(new Error('No se pudo completar la exportación')));
      archive.append(stream, { name: archiveName });
    }

    void archive.finalize().catch(() => passThrough.destroy(new Error('No se pudo completar la exportación')));

    return new StreamableFile(passThrough, {
      type: 'application/zip',
      disposition: `attachment; filename="${raiz}.zip"`,
    });
  }
}
