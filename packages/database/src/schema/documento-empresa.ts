import { pgTable, uuid, varchar, text, integer, timestamp, index } from 'drizzle-orm/pg-core';
import { empresa } from './empresa';
import { usuario } from './usuario';

// Repositorio de documentos a nivel de EMPRESA (no de una factura): información
// financiera de respaldo que el contador necesita para la contabilidad —
// cronogramas de préstamo, estados de cuenta bancarios, contratos de leasing, etc.
// No es un catálogo cerrado: cada documento se identifica con un título libre.
// Muchos son periódicos, por eso el año/mes opcional para filtrarlos.
export const documentoEmpresa = pgTable('documento_empresa', {
  id: uuid('id').primaryKey().defaultRandom(),
  empresaId: uuid('empresa_id').notNull().references(() => empresa.id, { onDelete: 'cascade' }),
  titulo: varchar('titulo', { length: 255 }).notNull(),
  descripcion: text('descripcion'),
  // Periodo opcional al que corresponde el documento (p. ej. estado de cuenta de mayo 2026).
  anio: integer('anio'),
  mes: integer('mes'),
  archivoStoragePath: varchar('archivo_storage_path', { length: 512 }).notNull(),
  archivoNombreOriginal: varchar('archivo_nombre_original', { length: 255 }).notNull(),
  subidoPor: uuid('subido_por').references(() => usuario.id, { onDelete: 'set null' }),
  fechaSubida: timestamp('fecha_subida', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  // Listado por empresa, más reciente primero.
  index('idx_documento_empresa_empresa').on(table.empresaId, table.fechaSubida.desc()),
]);
