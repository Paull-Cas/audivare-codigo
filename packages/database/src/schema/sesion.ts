import { pgTable, uuid, timestamp, index } from 'drizzle-orm/pg-core';
import { usuario } from './usuario';

export const sesion = pgTable('sesion', {
  id: uuid('id').primaryKey().defaultRandom(),
  usuarioId: uuid('usuario_id').notNull().references(() => usuario.id, { onDelete: 'cascade' }),
  fechaCreacion: timestamp('fecha_creacion', { withTimezone: true }).notNull().defaultNow(),
  fechaExpiracion: timestamp('fecha_expiracion', { withTimezone: true }).notNull(),
}, (table) => [
  index('idx_sesion_usuario').on(table.usuarioId),
  index('idx_sesion_expiracion').on(table.fechaExpiracion),
]);
