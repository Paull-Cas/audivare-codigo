import { pgTable, uuid, timestamp } from 'drizzle-orm/pg-core';
import { empresa } from './empresa';
import { usuario } from './usuario';

export const relacionEmpresaContador = pgTable('relacion_empresa_contador', {
  id: uuid('id').primaryKey().defaultRandom(),
  empresaId: uuid('empresa_id').notNull().references(() => empresa.id, { onDelete: 'cascade' }),
  contadorId: uuid('contador_id').notNull().references(() => usuario.id, { onDelete: 'cascade' }),
  fechaVinculacion: timestamp('fecha_vinculacion', { withTimezone: true }).defaultNow(),
});
