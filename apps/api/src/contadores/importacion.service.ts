import { Injectable, ForbiddenException, BadRequestException } from '@nestjs/common';
import { db, factura, empresa, relacionEmpresaContador, loteImportacion } from '@audivare/database';
import { eq, and, sql, inArray } from 'drizzle-orm';
import { claveFactura, claveFacturaSql, fechaValida } from '../facturas/factura-datos';
import { leerExcelSeguro } from './excel-seguro';
import { LIMITES_TRABAJO, validarFilas, cupoImportacion, controlarFrecuenciaTrabajo } from '../common/limites-trabajo';
import { PermisosService } from '../common/permisos/permisos.service';
import { NotificacionesService } from '../notificaciones/notificaciones.service';
import { ArchivoMultipart } from '../common/multipart.util';
import type { DbExecutor } from '../notificaciones/notificaciones.service';
import { AnalisisArchivosService } from '../storage/analisis-archivos.service';

/**
 * Posiciones (0-based) de las columnas en el Registro de Compras SUNAT estándar.
 * Solo se usan como **respaldo**: lo normal es ubicar las columnas por su nombre
 * en la cabecera (ver NOMBRES_COL), para no depender del orden.
 */
const COL_POR_POSICION = {
  fechaEmision: 4, // "Fecha de emisión" (DD/MM/YYYY)
  serie: 7, // "Serie del CDP"
  numero: 9, // "Nro CP o Doc. Nro Inicial (Rango)"
  proveedorRuc: 12, // "Nro Doc Identidad"
  proveedorNombre: 13, // "Apellidos Nombres/ Razón Social"
  total: 24, // "Total CP"
  moneda: 25, // "Moneda"
} as const;

type CampoCol = keyof typeof COL_POR_POSICION;

/** Mínimo de columnas del registro estándar, para validar el respaldo por posición. */
const COLUMNAS_MINIMAS = Math.max(...Object.values(COL_POR_POSICION)) + 1;

/**
 * Nombres de cabecera de cada campo (ya normalizados: minúsculas, sin acentos).
 * Se admiten variantes porque SUNAT no es consistente con espacios y puntos.
 */
const NOMBRES_COL: Record<CampoCol, string[]> = {
  fechaEmision: ['fecha de emision'],
  serie: ['serie del cdp', 'serie'],
  numero: [
    'nro cp o doc. nro inicial (rango)',
    'nro cp o doc nro inicial (rango)',
    'nro cp o doc. nro inicial(rango)',
  ],
  proveedorRuc: ['nro doc identidad', 'nro. doc identidad'],
  proveedorNombre: [
    'apellidos nombres/ razon social',
    'apellidos nombres / razon social',
    'apellidos nombres/razon social',
  ],
  total: ['total cp'],
  moneda: ['moneda'],
};

/** Etiqueta legible de cada campo, para los mensajes de error. */
const ETIQUETA_COL: Record<CampoCol, string> = {
  fechaEmision: 'Fecha de emisión',
  serie: 'Serie del CDP',
  numero: 'Nro CP o Doc. Nro Inicial (Rango)',
  proveedorRuc: 'Nro Doc Identidad',
  proveedorNombre: 'Apellidos Nombres/ Razón Social',
  total: 'Total CP',
  moneda: 'Moneda',
};

/** Separadores admitidos: SUNAT entrega ';', pero algunos exportadores usan ','. */
type Delimitador = ';' | ',';

/** Normaliza una cabecera para compararla: sin acentos, minúsculas, espacios colapsados. */
function normalizarCabecera(valor: string): string {
  return valor
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '') // quita los acentos separados por NFD
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

interface FilaParseada {
  linea: number;
  tipoComprobante: string;
  serie: string;
  numero: string;
  proveedorRuc: string | null;
  proveedorNombre: string;
  montoTotal: string;
  moneda: 'PEN' | 'USD';
  fechaEmision: string; // YYYY-MM-DD
}

export interface ResultadoImportacion {
  lote_id: string | null;
  total_filas: number;
  creadas: number;
  omitidas: number;
  errores: number;
  detalle_errores: string[];
  revision?: RevisionImportacion;
}

interface RevisionImportacion {
  nuevas: number; coincidentes: number; diferencias: number; identidadInsuficiente: number;
  detalles: { linea: number; comprobante: string; estado: string; facturaId?: string; campos?: string[] }[];
}

@Injectable()
export class ImportacionService {
  constructor(
    private readonly permisosService: PermisosService,
    private readonly notificacionesService: NotificacionesService,
    private readonly analisisService: AnalisisArchivosService = new AnalisisArchivosService(),
  ) {}

  private async verificarVinculo(userId: string, tipoUsuario: string, empresaId: string, executor: DbExecutor = db) {
    if (tipoUsuario !== 'CONTADOR_EXTERNO') {
      throw new ForbiddenException('Solo el contador externo puede importar facturas');
    }
    const rel = await executor
      .select()
      .from(relacionEmpresaContador)
      .where(and(
        eq(relacionEmpresaContador.empresaId, empresaId),
        eq(relacionEmpresaContador.contadorId, userId),
      ));
    if (!rel.length) {
      throw new ForbiddenException('No estás vinculado a esta empresa');
    }
    await this.permisosService.checkEmpresaActiva(empresaId, executor);
  }

  /** Limpia el nombre del proveedor: quita ruido inicial (puntos/espacios) y colapsa espacios. */
  private limpiarNombre(valor: string): string {
    return valor.replace(/^[.\s]+/, '').replace(/\s+/g, ' ').trim();
  }

  /** Convierte "DD/MM/YYYY" a "YYYY-MM-DD". Devuelve null si no es válida. */
  private parsearFecha(valor: string): string | null {
    const m = valor.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (!m) return null;
    const d = Number(m[1]);
    const mes = Number(m[2]);
    const y = Number(m[3]);
    if (mes < 1 || mes > 12 || d < 1 || d > 31) return null;
    const fecha = `${y}-${String(mes).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    return fechaValida(fecha) ? fecha : null;
  }

  /**
   * Decide con qué lector abrir el archivo. Se mira la **firma binaria** además
   * de la extensión: así se detecta un Excel aunque venga renombrado a .csv.
   */
  private detectarTipo(file: ArchivoMultipart): 'csv' | 'xlsx' {
    const nombre = (file.filename ?? '').toLowerCase();
    const buf = file.buffer;

    // .xls antiguo es OLE2 (D0 CF 11 E0); exceljs no lo soporta.
    const esXlsAntiguo =
      buf.length > 3 && buf[0] === 0xd0 && buf[1] === 0xcf && buf[2] === 0x11 && buf[3] === 0xe0;
    if (esXlsAntiguo || nombre.endsWith('.xls')) {
      throw new BadRequestException(
        'El formato .xls (Excel antiguo) no es compatible. Ábrelo y guárdalo como .xlsx, o descarga el CSV del Registro de Compras de SUNAT.',
      );
    }

    // .xlsx es un ZIP: empieza con "PK".
    const esZip = buf.length > 1 && buf[0] === 0x50 && buf[1] === 0x4b;
    return esZip || nombre.endsWith('.xlsx') ? 'xlsx' : 'csv';
  }

  /** Lee un CSV (detectando su separador) y lo devuelve como filas de texto. */
  private leerCsv(contenido: string): string[][] {
    // Quitar BOM y normalizar saltos de línea.
    const limpio = contenido.replace(/^﻿/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const lineas = limpio.split('\n').filter((l) => l.trim().length > 0);
    if (lineas.length > LIMITES_TRABAJO.filas + 1) throw new BadRequestException('Máximo 5000 filas por importación. Divide el archivo.');
    if (!lineas.length) return [];

    const delimitador = this.detectarDelimitador(lineas[0]);
    return lineas.map((l) => this.partirLinea(l, delimitador));
  }

  /**
   * Ubica cada columna por su **nombre** en la cabecera, para no depender del
   * orden. Si la cabecera no se reconoce (otro idioma, sin fila de títulos) se
   * recurre a las posiciones del registro estándar. Nunca se mezclan ambos
   * criterios: hacerlo podría leer un importe de la columna equivocada.
   */
  private mapearColumnas(cabecera: string[]): Record<CampoCol, number> {
    const normalizadas = cabecera.map(normalizarCabecera);
    const campos = Object.keys(NOMBRES_COL) as CampoCol[];

    const porNombre = {} as Partial<Record<CampoCol, number>>;
    for (const campo of campos) {
      const idx = normalizadas.findIndex((h) => NOMBRES_COL[campo].includes(h));
      if (idx >= 0) porNombre[campo] = idx;
    }

    const encontrados = campos.filter((c) => porNombre[c] !== undefined);

    // Todas por nombre: el caso normal, funciona en cualquier orden.
    if (encontrados.length === campos.length) return porNombre as Record<CampoCol, number>;

    // Ninguna por nombre: cabecera desconocida → respaldo por posición, solo si
    // el archivo tiene la forma del registro estándar.
    if (encontrados.length === 0) {
      if (cabecera.length >= COLUMNAS_MINIMAS) return { ...COL_POR_POSICION };
      throw new BadRequestException(
        `El archivo no tiene el formato del Registro de Compras SUNAT: no se reconocieron las columnas y solo trae ${cabecera.length} (se esperaban al menos ${COLUMNAS_MINIMAS}).`,
      );
    }

    // Algunas sí y otras no: la cabecera se reconoce pero está incompleta.
    // Se informa qué falta en vez de adivinar posiciones.
    const faltantes = campos.filter((c) => porNombre[c] === undefined).map((c) => `"${ETIQUETA_COL[c]}"`);
    throw new BadRequestException(
      `Al archivo le faltan columnas obligatorias del Registro de Compras: ${faltantes.join(', ')}.`,
    );
  }

  /**
   * Detecta el separador mirando la cabecera. Se cuenta ahí y no en los datos
   * porque los importes y los nombres de proveedor sí pueden traer comas.
   */
  private detectarDelimitador(cabecera: string): Delimitador {
    const puntoYComa = (cabecera.match(/;/g) ?? []).length;
    const comas = (cabecera.match(/,/g) ?? []).length;

    if (puntoYComa === 0 && comas === 0) {
      throw new BadRequestException(
        'El archivo no parece un CSV: no se encontraron columnas separadas por ";" ni por ",". Descarga el Registro de Compras de SUNAT en formato CSV.',
      );
    }
    return puntoYComa >= comas ? ';' : ',';
  }

  /** Parte una línea del CSV respetando comillas dobles (por si algún campo las trae). */
  private partirLinea(linea: string, delimitador: Delimitador): string[] {
    const campos: string[] = [];
    let actual = '';
    let enComillas = false;
    for (let i = 0; i < linea.length; i++) {
      const c = linea[i];
      if (c === '"') {
        enComillas = !enComillas;
      } else if (c === delimitador && !enComillas) {
        campos.push(actual);
        actual = '';
      } else {
        actual += c;
      }
    }
    campos.push(actual);
    return campos;
  }

  /**
   * Parsea las filas ya leídas (vengan de CSV o de Excel). La primera es la
   * cabecera, que se usa para ubicar las columnas y luego se descarta.
   */
  private parsearFilas(crudas: string[][]): { filas: FilaParseada[]; errores: string[]; totalFilas: number } {
    if (crudas.length <= 1) {
      throw new BadRequestException('El archivo no contiene filas de datos');
    }

    const COL = this.mapearColumnas(crudas[0]);
    const cabeceraNormalizada = crudas[0].map(normalizarCabecera);
    const tipoCol = cabeceraNormalizada.findIndex(h => ['tipo de cdp', 'tipo del cdp', 'tipo cdp', 'tipo comprobante', 'tipo de comprobante', 'tipo de comprobante de pago', 'tipo de cp/doc.', 'tipo de cp/doc', 'tipo cp/doc.'].includes(h));
    // El respaldo por posición se usa solo con cabecera totalmente desconocida;
    // no adivinar una columna opcional en un archivo reconocido/reordenado.
    const porPosicion = !cabeceraNormalizada.some(h => Object.values(NOMBRES_COL).some(nombres => nombres.includes(h)));

    const filas: FilaParseada[] = [];
    const errores: string[] = [];
    let totalFilas = 0;

    for (let i = 1; i < crudas.length; i++) {
      totalFilas++;
      const campos = crudas[i];
      const nroLinea = i + 1;

      const serie = (campos[COL.serie] ?? '').trim();
      const numero = (campos[COL.numero] ?? '').trim();
      const fechaRaw = (campos[COL.fechaEmision] ?? '').trim();
      const rucRaw = (campos[COL.proveedorRuc] ?? '').trim();
      const nombreRaw = (campos[COL.proveedorNombre] ?? '').trim();
      const totalRaw = (campos[COL.total] ?? '').trim();
      const monedaRaw = (campos[COL.moneda] ?? '').trim().toUpperCase();

      if (!serie || !numero) {
        errores.push(`Línea ${nroLinea}: sin serie o número, se omitió.`);
        continue;
      }
      const fechaEmision = this.parsearFecha(fechaRaw);
      if (!fechaEmision) {
        errores.push(`Línea ${nroLinea} (${serie}-${numero}): fecha de emisión inválida "${fechaRaw}", se omitió.`);
        continue;
      }
      const total = Number(totalRaw.replace(/,/g, ''));
      if (!Number.isFinite(total) || total <= 0 || total >= 10000000000 || Math.abs(total * 100 - Math.round(total * 100)) > 1e-6) {
        errores.push(`Línea ${nroLinea} (${serie}-${numero}): total inválido "${totalRaw}", se omitió.`);
        continue;
      }
      if (!['PEN', 'USD'].includes(monedaRaw)) {
        errores.push(`Línea ${nroLinea}: moneda inválida, se omitió.`); continue;
      }
      const moneda: 'PEN' | 'USD' = monedaRaw === 'USD' ? 'USD' : 'PEN';
      if (serie.length > 20 || numero.length > 20 || rucRaw.length > 20 || this.limpiarNombre(nombreRaw).length > 255) {
        errores.push(`Línea ${nroLinea}: un campo supera el tamaño permitido, se omitió.`); continue;
      }

      filas.push({
        linea: nroLinea,
        tipoComprobante: ((tipoCol >= 0 ? campos[tipoCol] : (porPosicion && crudas[0].length >= 26 ? campos[6] : '01')) || '01').trim().padStart(2, '0'),
        serie,
        numero,
        proveedorRuc: rucRaw || null,
        proveedorNombre: this.limpiarNombre(nombreRaw) || 'Proveedor',
        montoTotal: total.toFixed(2),
        moneda,
        fechaEmision,
      });
    }

    return { filas, errores, totalFilas };
  }

  /**
   * Importa el Registro de Compras SUNAT (CSV) creando las facturas de la empresa.
   * Anti-duplicado por (empresa, serie, número, RUC proveedor): las ya existentes
   * se omiten (no se duplican ni se sobrescriben). Cada factura nace ACTIVA con
   * saldo = total y documentación PENDIENTE.
   */
  async importar(userId: string, tipoUsuario: string, empresaId: string, file: ArchivoMultipart, revisar = false): Promise<ResultadoImportacion> {
    await this.verificarVinculo(userId, tipoUsuario, empresaId);
    controlarFrecuenciaTrabajo('importacion', userId);
    const liberar = cupoImportacion.adquirir();
    try { return await this.importarLimitado(userId, tipoUsuario, empresaId, file, revisar); }
    finally { liberar(); }
  }

  private async importarLimitado(
    userId: string,
    tipoUsuario: string,
    empresaId: string,
    file: ArchivoMultipart,
    revisar = false,
  ): Promise<ResultadoImportacion> {
    await this.verificarVinculo(userId, tipoUsuario, empresaId);

    if (!file || !file.buffer?.length) {
      throw new BadRequestException('El archivo es obligatorio');
    }

    if (file.buffer.length > LIMITES_TRABAJO.archivo) throw new BadRequestException('El archivo no debe superar 10 MB');
    if (this.analisisService.enabled) {
      this.analisisService.exigirLimpio(await this.analisisService.analizarBuffer(file.buffer, 'application/octet-stream'));
    }

    // Dos lectores (CSV o Excel) que alimentan el mismo parseo por nombre de columna.
    const crudas =
      this.detectarTipo(file) === 'xlsx'
        ? await leerExcelSeguro(file.buffer)
        : this.leerCsv(file.buffer.toString('utf-8'));

    validarFilas(crudas);
    const { filas, errores, totalFilas } = this.parsearFilas(crudas);

    // La creación del lote y sus facturas es atómica: o queda todo el lote
    // registrado o nada (así "deshacer importación" opera sobre un lote íntegro).
    const { loteId, creadas, omitidas, revision } = await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${'importacion:' + empresaId}, 0))`);
      // Se vuelve a autorizar después de esperar otra importación.
      await this.verificarVinculo(userId, tipoUsuario, empresaId, tx);
      const claves = [...new Set(filas.map(claveFactura))];
      const existentes = claves.length ? await tx.select().from(factura).where(and(eq(factura.empresaId, empresaId), inArray(claveFacturaSql, claves))) : [];
      const porClave = new Map<string, typeof existentes>();
      for (const f of existentes) { const k = claveFactura(f); porClave.set(k, [...(porClave.get(k) ?? []), f]); }
      const revision: RevisionImportacion = { nuevas: 0, coincidentes: 0, diferencias: 0, identidadInsuficiente: 0, detalles: [] };
      const nuevas: FilaParseada[] = [];
      const vistas = new Map<string, FilaParseada>();
      for (const fila of filas) {
        const clave = claveFactura(fila);
        const iguales = porClave.get(clave) ?? [];
        const previa = vistas.get(clave);
        let estado = 'NUEVA'; let campos: string[] = [];
        if (!/^\d{11}$/.test(fila.proveedorRuc?.replace(/\s/g, '') ?? '') || !/^[A-Z0-9]+$/i.test(fila.serie.replace(/\s/g, '')) || !/^\d+$/.test(fila.numero.replace(/\s/g, '')) || !['01', '03', '07', '08'].includes(fila.tipoComprobante)) {
          estado = 'IDENTIDAD_INSUFICIENTE'; revision.identidadInsuficiente++;
        } else if (iguales.length || previa) {
          const existente = iguales[0] ?? previa;
          campos = (['proveedorNombre', 'montoTotal', 'moneda', 'fechaEmision'] as const)
            .filter(k => k === 'proveedorNombre' ? (existente[k] ?? '').trim().replace(/\s+/g, ' ').toUpperCase() !== fila[k].trim().replace(/\s+/g, ' ').toUpperCase() : existente[k] !== fila[k]);
          estado = campos.length || iguales.length > 1 ? 'DIFERENCIAS' : 'COINCIDENTE';
          if (estado === 'DIFERENCIAS') revision.diferencias++; else revision.coincidentes++;
        } else { nuevas.push(fila); revision.nuevas++; vistas.set(clave, fila); }
        if (revision.detalles.length < 50) revision.detalles.push({ linea: fila.linea, comprobante: `${fila.serie}-${fila.numero}`, estado, facturaId: iguales[0]?.id, campos });
      }
      if (revisar) return { loteId: null, creadas: 0, omitidas: filas.length - nuevas.length, revision };
      const [receptor] = await tx.select({ ruc: empresa.ruc, razonSocial: empresa.razonSocial })
        .from(empresa).where(eq(empresa.id, empresaId));
      let creadas = 0;
      let omitidas = 0;

      // El lote agrupa las facturas de esta importación (permite deshacerla).
      const loteRows = await tx.insert(loteImportacion).values({
        empresaId,
        contadorId: userId,
        nombreArchivo: file.filename ?? null,
        totalFilas,
        creadas: 0,
      }).returning({ id: loteImportacion.id });
      const loteId = loteRows[0].id;

      omitidas = filas.length - nuevas.length;
      for (const fila of nuevas) {
        const insertadas = await tx.insert(factura).values({
          empresaId,
          tipoComprobante: fila.tipoComprobante,
          claveIdentidad: claveFactura(fila),
          serie: fila.serie.replace(/\s/g, '').toUpperCase(),
          numero: fila.numero.replace(/\s/g, '').replace(/^0+(?=\d)/, ''),
          proveedorRuc: fila.proveedorRuc?.replace(/\s/g, '') ?? null,
          proveedorNombre: fila.proveedorNombre,
          receptorRuc: receptor?.ruc ?? null,
          receptorRazonSocial: receptor?.razonSocial ?? null,
          moneda: fila.moneda,
          montoTotal: fila.montoTotal,
          saldoPendiente: fila.montoTotal,
          fechaEmision: fila.fechaEmision,
          estadoFactura: 'ACTIVA',
          documentacionEstado: 'PENDIENTE',
          creadoPor: userId,
          loteImportacionId: loteId,
        }).onConflictDoNothing().returning({ id: factura.id });
        if (insertadas.length) creadas++;
        else omitidas++;
      }

      // Si no se creó ninguna factura (todo duplicado/errores) el lote no aporta
      // nada: se descarta para no ensuciar el listado de importaciones.
      if (creadas === 0) {
        await tx.delete(loteImportacion).where(eq(loteImportacion.id, loteId));
        return { loteId: null as string | null, creadas, omitidas, revision };
      }

      await tx.update(loteImportacion)
        .set({ creadas })
        .where(eq(loteImportacion.id, loteId));

      // Aviso a la empresa: se importaron nuevos comprobantes.
      if (creadas > 0) {
        const destinatarios = await this.permisosService.getUsuariosConPermiso(empresaId, 'FACTURA_READ', undefined, tx);
        for (const destinatarioId of destinatarios) {
          await this.notificacionesService.crearNotificacion(
            destinatarioId,
            'FACTURAS_IMPORTADAS',
            'Nuevas facturas importadas',
            `El contador importó ${creadas} factura(s) desde el registro de compras SUNAT.`,
            { empresa_id: empresaId, cantidad_facturas: creadas }, tx,
          );
        }
      }
      return { loteId: loteId as string | null, creadas, omitidas, revision };
    });


    return {
      lote_id: loteId,
      total_filas: totalFilas,
      creadas,
      omitidas,
      errores: errores.length,
      detalle_errores: errores.slice(0, 50),
      revision,
    };
  }
}
