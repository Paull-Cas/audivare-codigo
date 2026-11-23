import { pgTable, uuid, varchar, integer, timestamp, index } from 'drizzle-orm/pg-core';
import { empresa } from './empresa';
import { usuario } from './usuario';

// Un lote agrupa las facturas creadas en una misma importación del Registro de
// Compras SUNAT. Permite "deshacer" una importación equivocada (subir el Excel
// de otra empresa) borrando de un golpe solo lo que ese archivo creó, sin tocar
// facturas de otras importaciones. Se conserva como registro de auditoría
// (marcado con `revertidoEn`) aunque sus facturas ya no existan.
export const loteImportacion = pgTable('lote_importacion', {
  id: uuid('id').primaryKey().defaultRandom(),
  empresaId: uuid('empresa_id').notNull().references(() => empresa.id, { onDelete: 'cascade' }),
  // Quién importó (contador externo). Se conserva el lote aunque el contador se
  // elimine, por eso `set null`.
  contadorId: uuid('contador_id').references(() => usuario.id, { onDelete: 'set null' }),
  nombreArchivo: varchar('nombre_archivo', { length: 255 }),
  totalFilas: integer('total_filas').notNull().default(0),
  creadas: integer('creadas').notNull().default(0),
  // Marca de que la importación fue deshecha (auditoría). Null = vigente.
  revertidoEn: timestamp('revertido_en', { withTimezone: true }),
  fechaCreacion: timestamp('fecha_creacion', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  // Lotes recientes de una empresa (para listarlos y deshacerlos).
  index('idx_lote_importacion_empresa').on(table.empresaId, table.fechaCreacion.desc()),
]);
