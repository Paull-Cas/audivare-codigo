import { pgTable, uuid, varchar } from 'drizzle-orm/pg-core';
import { usuario } from './usuario';

// Permisos de plataforma para superadmins secundarios. El principal (seed,
// usuario.es_superadmin_principal) tiene bypass total y no usa esta tabla.
// Catálogo de códigos en la API (superadmin/sa-permisos.ts), no en BD.
export const superadminPermiso = pgTable('superadmin_permiso', {
  id: uuid('id').primaryKey().defaultRandom(),
  usuarioId: uuid('usuario_id').notNull().references(() => usuario.id, { onDelete: 'cascade' }),
  codigoPermiso: varchar('codigo_permiso', { length: 50 }).notNull(),
});
