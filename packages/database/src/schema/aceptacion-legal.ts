import { pgTable, uuid, varchar, text, timestamp, boolean, uniqueIndex, check } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// Sin cascadas: la evidencia no desaparece al retirar una cuenta o una empresa.
export const documentoLegal = pgTable('documento_legal', {
  id: uuid('id').primaryKey().defaultRandom(),
  version: varchar('version', { length: 40 }).notNull(),
  sha256: varchar('sha256', { length: 64 }).notNull(),
  contenido: text('contenido').notNull(),
  creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
}, t => [uniqueIndex('documento_legal_version_unico').on(t.version),
  check('documento_legal_hash_valido', sql`${t.sha256} ~ '^[0-9a-f]{64}$'`)]);

export const aceptacionLegal = pgTable('aceptacion_legal', {
  id: uuid('id').primaryKey().defaultRandom(),
  usuarioId: uuid('usuario_id').notNull(),
  empresaId: uuid('empresa_id'),
  documentoId: uuid('documento_id').notNull().references(() => documentoLegal.id),
  origen: varchar('origen', { length: 20 }).notNull(),
  representaEmpresa: boolean('representa_empresa').notNull().default(false),
  aceptadaEn: timestamp('aceptada_en', { withTimezone: true }).notNull().defaultNow(),
}, t => [uniqueIndex('aceptacion_legal_usuario_documento_unico').on(t.usuarioId, t.documentoId),
  check('aceptacion_legal_origen_valido', sql`${t.origen} IN ('REGISTRO', 'REVISION')`),
  check('aceptacion_legal_representacion_valida', sql`(${t.representaEmpresa} AND ${t.empresaId} IS NOT NULL) OR (NOT ${t.representaEmpresa} AND ${t.empresaId} IS NULL)`)]);
