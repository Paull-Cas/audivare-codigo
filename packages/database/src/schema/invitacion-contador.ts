import { pgTable, uuid, varchar, timestamp, pgEnum } from 'drizzle-orm/pg-core';
import { empresa } from './empresa';

export const estadoInvitacionEnum = pgEnum('estado_invitacion', ['PENDIENTE', 'ACEPTADA', 'RECHAZADA', 'REVOCADA']);

export const invitacionContador = pgTable('invitacion_contador', {
  id: uuid('id').primaryKey().defaultRandom(),
  empresaId: uuid('empresa_id').notNull().references(() => empresa.id, { onDelete: 'cascade' }),
  contadorEmail: varchar('contador_email', { length: 255 }).notNull(),
  estadoInvitacion: estadoInvitacionEnum('estado_invitacion').default('PENDIENTE'),
  fechaEnvio: timestamp('fecha_envio', { withTimezone: true }).defaultNow(),
});
