import { pgTable, uuid, varchar } from 'drizzle-orm/pg-core';

export const permiso = pgTable('permiso', {
  id: uuid('id').primaryKey().defaultRandom(),
  codigoPermiso: varchar('codigo_permiso', { length: 100 }).notNull().unique(),
  descripcion: varchar('descripcion', { length: 255 }),
});
