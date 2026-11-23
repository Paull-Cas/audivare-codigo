import { pgTable, uuid, varchar, timestamp, pgEnum, boolean } from 'drizzle-orm/pg-core';

export const tipoUsuarioEnum = pgEnum('tipo_usuario', ['SUPERADMIN', 'INTERNO', 'CONTADOR_EXTERNO']);

export const usuario = pgTable('usuario', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  nombreCompleto: varchar('nombre_completo', { length: 255 }),
  passwordHash: varchar('password_hash', { length: 255 }),
  tipoUsuario: tipoUsuarioEnum('tipo_usuario').notNull(),
  avatarUrl: varchar('avatar_url', { length: 512 }),
  // Superadmin sembrado por el seed: acceso total, no editable ni eliminable
  esSuperadminPrincipal: boolean('es_superadmin_principal').notNull().default(false),
  fechaRegistro: timestamp('fecha_registro', { withTimezone: true }).defaultNow(),
});
