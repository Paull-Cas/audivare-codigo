import { pgTable, uuid, varchar, text, timestamp, pgEnum, index } from 'drizzle-orm/pg-core';
import { factura } from './factura';
import { usuario } from './usuario';

// Catálogo de documentación de sustento (fehaciencia SUNAT) que la empresa o el
// contador cargan por factura. OTROS admite un tipo escrito libre (se guarda en
// `descripcion`). Ninguno es obligatorio: no toda operación maneja todos los documentos.
export const tipoDocumentoEnum = pgEnum('tipo_documento', [
  'GUIA_REMISION_REMITENTE',
  'GUIA_REMISION_TRANSPORTISTA',
  'COTIZACION',
  'CONTRATO',
  'OTROS',
]);

export const documentoSustento = pgTable('documento_sustento', {
  id: uuid('id').primaryKey().defaultRandom(),
  facturaId: uuid('factura_id').notNull().references(() => factura.id, { onDelete: 'cascade' }),
  tipoDocumento: tipoDocumentoEnum('tipo_documento').notNull(),
  // Para OTROS: el tipo escrito por la empresa. Opcional para el resto.
  descripcion: text('descripcion'),
  archivoStoragePath: varchar('archivo_storage_path', { length: 512 }).notNull(),
  archivoNombreOriginal: varchar('archivo_nombre_original', { length: 255 }).notNull(),
  subidoPor: uuid('subido_por').references(() => usuario.id, { onDelete: 'set null' }),
  fechaSubida: timestamp('fecha_subida', { withTimezone: true }).defaultNow(),
}, (table) => [
  // Los documentos se consultan por factura
  index('idx_documento_factura').on(table.facturaId),
]);
