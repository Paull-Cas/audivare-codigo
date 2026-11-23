import { pgTable, uuid, varchar, text, boolean } from 'drizzle-orm/pg-core';
import { empresa } from './empresa';

export const rol = pgTable('rol', {
  id: uuid('id').primaryKey().defaultRandom(),
  empresaId: uuid('empresa_id').notNull().references(() => empresa.id, { onDelete: 'cascade' }),
  nombreRol: varchar('nombre_rol', { length: 100 }).notNull(),
  descripcion: text('descripcion'),
  esInmutable: boolean('es_inmutable').notNull().default(false),
});
