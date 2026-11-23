import { pgTable, uuid, varchar, timestamp, integer, uniqueIndex } from 'drizzle-orm/pg-core';

// No FK/cascade: conservar tareas incluso después de borrar empresa/factura.
export const storageRevision = pgTable('storage_revision', {
  id: uuid('id').primaryKey().defaultRandom(),
  bucket: varchar('bucket', { length: 255 }).notNull(),
  objectPath: varchar('object_path', { length: 512 }).notNull(),
  motivo: varchar('motivo', { length: 30 }).$type<'SIN_REFERENCIA' | 'LIMPIEZA_FALLIDA' | 'REFERENCIA_FALTANTE'>().notNull(),
  estado: varchar('estado', { length: 20 }).$type<'PENDIENTE' | 'PROTEGIDO' | 'ELIMINADO' | 'RESUELTO'>().notNull().default('PENDIENTE'),
  primeraDeteccion: timestamp('primera_deteccion', { withTimezone: true }).notNull().defaultNow(),
  ultimaDeteccion: timestamp('ultima_deteccion', { withTimezone: true }).notNull().defaultNow(),
  proximoIntento: timestamp('proximo_intento', { withTimezone: true }),
  intentos: integer('intentos').notNull().default(0),
  ultimoError: varchar('ultimo_error', { length: 255 }),
}, t => [uniqueIndex('uq_storage_revision_objeto').on(t.bucket, t.objectPath)]);
