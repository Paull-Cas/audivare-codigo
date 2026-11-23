import { pgTable, uuid, varchar, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';

// Cuarentena lógica independiente de filas de negocio; no modifica ni elimina el original.
export const archivoAnalisis = pgTable('archivo_analisis', {
  id: uuid('id').primaryKey().defaultRandom(),
  bucket: varchar('bucket', { length: 255 }).notNull(),
  objectPath: varchar('object_path', { length: 512 }).notNull(),
  estado: varchar('estado', { length: 20 }).$type<'LIMPIO' | 'CUARENTENA' | 'ERROR'>().notNull(),
  motivo: varchar('motivo', { length: 40 }).notNull(),
  sha256: varchar('sha256', { length: 64 }),
  etag: varchar('etag', { length: 128 }),
  motor: varchar('motor', { length: 100 }),
  analizadoEn: timestamp('analizado_en', { withTimezone: true }).notNull().defaultNow(),
}, t => [uniqueIndex('uq_archivo_analisis_objeto').on(t.bucket, t.objectPath)]);
