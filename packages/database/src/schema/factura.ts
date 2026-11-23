import { pgTable, uuid, varchar, decimal, date, timestamp, pgEnum, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { empresa } from './empresa';
import { usuario } from './usuario';
import { loteImportacion } from './lote-importacion';

// Ciclo de vida simplificado: la factura nace ACTIVA al importarse desde el
// registro de compras SUNAT y pasa a PAGADA automáticamente cuando el saldo
// llega a 0. Ya no existe flujo de aprobación interna.
export const estadoFacturaEnum = pgEnum('estado_factura', ['ACTIVA', 'PAGADA']);
export const monedaFacturaEnum = pgEnum('moneda_factura', ['PEN', 'USD']);
// Indicador documental, independiente del estado de pago. Lo marca la empresa
// manualmente cuando considera que ya subió toda la documentación que aplica
// (la documentación no es obligatoria: no toda factura lleva guía/contrato).
export const documentacionEstadoEnum = pgEnum('documentacion_estado', ['PENDIENTE', 'COMPLETA']);

export const factura = pgTable('factura', {
  id: uuid('id').primaryKey().defaultRandom(),
  empresaId: uuid('empresa_id').notNull().references(() => empresa.id, { onDelete: 'cascade' }),
  tipoComprobante: varchar('tipo_comprobante', { length: 2 }).notNull().default('01'),
  claveIdentidad: varchar('clave_identidad', { length: 100 }),
  baseImponible: decimal('base_imponible', { precision: 12, scale: 2 }),
  igv: decimal('igv', { precision: 12, scale: 2 }),
  serie: varchar('serie', { length: 20 }),
  numero: varchar('numero', { length: 20 }),
  // Emisor del comprobante (proveedor), tomado del registro de compras SUNAT.
  proveedorRuc: varchar('proveedor_ruc', { length: 20 }),
  proveedorNombre: varchar('proveedor_nombre', { length: 255 }),
  // Receptor: snapshot de la empresa al momento de importar la factura.
  receptorRuc: varchar('receptor_ruc', { length: 20 }),
  receptorRazonSocial: varchar('receptor_razon_social', { length: 255 }),
  moneda: monedaFacturaEnum('moneda').notNull().default('PEN'),
  // Total del comprobante ("Total CP" del registro SUNAT). Sin desglose de ítems
  // ni tributación: lo que importa es el monto y su documentación de respaldo.
  montoTotal: decimal('monto_total', { precision: 12, scale: 2 }),
  saldoPendiente: decimal('saldo_pendiente', { precision: 12, scale: 2 }),
  fechaEmision: date('fecha_emision'),
  estadoFactura: estadoFacturaEnum('estado_factura').notNull().default('ACTIVA'),
  documentacionEstado: documentacionEstadoEnum('documentacion_estado').notNull().default('PENDIENTE'),
  documentacionCompletadaPor: uuid('documentacion_completada_por').references(() => usuario.id),
  documentacionCompletadaEn: timestamp('documentacion_completada_en', { withTimezone: true }),
  // Quién importó la factura (contador externo). Se conserva el nombre `creado_por`.
  creadoPor: uuid('creado_por').references(() => usuario.id),
  // Lote de importación que la creó. Permite "deshacer" toda una importación de
  // un golpe. `set null` para no borrar la factura si se elimina el lote (el
  // borrado real va en sentido inverso: se borran las facturas del lote).
  loteImportacionId: uuid('lote_importacion_id').references(() => loteImportacion.id, { onDelete: 'set null' }),
  fechaCreacion: timestamp('fecha_creacion', { withTimezone: true }).defaultNow(),
  fechaActualizacion: timestamp('fecha_actualizacion', { withTimezone: true }).defaultNow(),
}, (table) => [
  // Cubre el listado de facturas por empresa: filtra por empresa_id y entrega ya
  // ordenado por fecha de emisión (desc) + id (desc), igual que el ORDER BY de la
  // consulta, así el paginado no necesita ordenar aparte.
  index('idx_factura_empresa_fecha').on(table.empresaId, table.fechaEmision.desc(), table.id.desc()),
  // Facturas de un lote de importación (para deshacer toda la importación).
  index('idx_factura_lote').on(table.loteImportacionId),
  uniqueIndex('uq_factura_identidad').on(table.empresaId, table.claveIdentidad),
  uniqueIndex('uq_factura_importacion_ruc').on(table.empresaId, table.tipoComprobante, table.serie, table.numero, table.proveedorRuc)
    .where(sql`${table.serie} is not null and ${table.numero} is not null and ${table.proveedorRuc} is not null`),
  uniqueIndex('uq_factura_importacion_nombre').on(table.empresaId, table.tipoComprobante, table.serie, table.numero, sql`coalesce(${table.proveedorNombre}, '')`)
    .where(sql`${table.serie} is not null and ${table.numero} is not null and ${table.proveedorRuc} is null`),
]);
