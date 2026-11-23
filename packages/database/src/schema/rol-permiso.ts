import { pgTable, uuid, primaryKey } from 'drizzle-orm/pg-core';
import { rol } from './rol';
import { permiso } from './permiso';

export const rolPermiso = pgTable('rol_permiso', {
  rolId: uuid('rol_id').notNull().references(() => rol.id, { onDelete: 'cascade' }),
  permisoId: uuid('permiso_id').notNull().references(() => permiso.id, { onDelete: 'cascade' }),
}, (t) => ({
  pk: primaryKey({ columns: [t.rolId, t.permisoId] }),
}));
