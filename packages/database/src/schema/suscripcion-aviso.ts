import { pgTable, uuid, varchar, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { empresa } from './empresa';

// Registro transaccional por ciclo/etapa, compartido entre procesos del servidor.
export const suscripcionAviso = pgTable('suscripcion_aviso', {
  id: uuid('id').primaryKey().defaultRandom(),
  empresaId: uuid('empresa_id').notNull().references(() => empresa.id, { onDelete: 'cascade' }),
  ciclo: varchar('ciclo', { length: 100 }).notNull(),
  etapa: varchar('etapa', { length: 20 }).$type<'VENCIDO' | 'BLOQUEADO'>().notNull(),
  fechaCreacion: timestamp('fecha_creacion', { withTimezone: true }).notNull().defaultNow(),
}, table => [uniqueIndex('uq_suscripcion_aviso_ciclo').on(table.empresaId, table.ciclo, table.etapa)]);
