import { pgTable, uuid, boolean } from 'drizzle-orm/pg-core';
import { empresa } from './empresa';
import { usuario } from './usuario';
import { rol } from './rol';

export const usuarioInternoEmpresa = pgTable('usuario_interno_empresa', {
  id: uuid('id').primaryKey().defaultRandom(),
  empresaId: uuid('empresa_id').notNull().references(() => empresa.id, { onDelete: 'cascade' }),
  usuarioId: uuid('usuario_id').notNull().references(() => usuario.id, { onDelete: 'cascade' }),
  rolId: uuid('rol_id').notNull().references(() => rol.id),
  estado: boolean('estado').default(true),
});
