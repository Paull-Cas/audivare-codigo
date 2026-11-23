import { pgTable, uuid, text, boolean, timestamp, index } from 'drizzle-orm/pg-core';
import { empresa } from './empresa';
import { usuario } from './usuario';

// Conversación (solicitudes/mensajes) a nivel de EMPRESA sobre la documentación
// financiera: el contador pide documentos ("necesito tus cronogramas de préstamo
// / estados de cuenta") y la empresa responde. No está atado a un documento
// concreto: es el hilo del módulo "Documentos de la empresa".
export const mensajeDocumentoEmpresa = pgTable('mensaje_documento_empresa', {
  id: uuid('id').primaryKey().defaultRandom(),
  empresaId: uuid('empresa_id').notNull().references(() => empresa.id, { onDelete: 'cascade' }),
  autorId: uuid('autor_id').references(() => usuario.id, { onDelete: 'set null' }),
  // true = lo escribió el contador; false = lo escribió la empresa (usuario interno).
  // Se guarda explícito para el estilo del hilo aunque el autor se elimine.
  deContador: boolean('de_contador').notNull(),
  contenido: text('contenido').notNull(),
  fechaCreacion: timestamp('fecha_creacion', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_mensaje_doc_empresa_empresa').on(table.empresaId, table.fechaCreacion),
]);
