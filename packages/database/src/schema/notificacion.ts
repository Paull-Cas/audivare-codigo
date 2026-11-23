import { pgTable, uuid, varchar, timestamp, boolean, jsonb, pgEnum } from 'drizzle-orm/pg-core';
import { usuario } from './usuario';

export const tipoNotificacionEnum = pgEnum('tipo_notificacion', [
  'INVITACION_EMPRESA',
  'REMOVIDO_EMPRESA',
  'INVITACION_ACEPTADA',
  'INVITACION_RECHAZADA',
  // La invitación dejó de estar disponible (la empresa la canceló o la reemplazó
  // por una nueva): la notificación deja de ofrecer aceptar/rechazar.
  'INVITACION_CANCELADA',
  'OBSERVACION_CREADA',
  'OBSERVACION_ATENDIDA',
  // El contador importa comprobantes desde el registro de compras SUNAT → avisa a la empresa.
  'FACTURAS_IMPORTADAS',
  // El contador elimina/deshace una importación de facturas → avisa a la empresa.
  'FACTURAS_ELIMINADAS',
  // La empresa carga un documento de respaldo → avisa al contador.
  'DOCUMENTO_CARGADO',
  // La empresa carga un documento a nivel de empresa (préstamo/estado de cuenta/leasing) → avisa al contador.
  'DOCUMENTO_EMPRESA_CARGADO',
  // Mensaje/solicitud en el hilo de documentos de la empresa (contador↔empresa).
  'MENSAJE_DOC_EMPRESA',
  // La empresa marca la documentación de una factura como completa → avisa al contador.
  'DOCUMENTACION_COMPLETADA',
  'PAGO_REGISTRADO',
  // El superadmin reduce el límite de usuarios por debajo del uso actual →
  // se desactivan los últimos registrados y se avisa a la empresa.
  'LIMITE_USUARIOS_REDUCIDO',
  // Venció el mes del pago del servicio → avisa al superadmin y a la empresa;
  // hay 7 días de gracia para registrar el pago antes de la suspensión automática.
  'PAGO_SUSCRIPCION_VENCIDO',
  // Pasaron los 7 días de gracia sin pago → la empresa quedó suspendida.
  'EMPRESA_SUSPENDIDA_POR_PAGO',
  // Una nueva empresa se registró y espera su primer pago para ser activada →
  // avisa a los superadmins que gestionan empresas.
  'EMPRESA_REGISTRADA_PENDIENTE',
]);

/** Datos adicionales que acompañan a una notificación según su tipo. */
export interface MetadataNotificacion {
  documento_mensual?: boolean;
  empresa_id?: string;
  empresa_nombre?: string;
  invitacion_id?: string;
  contador_id?: string;
  contador_email?: string;
  factura_id?: string;
  factura_serie?: string;
  factura_numero?: string;
  observacion_id?: string;
  pago_id?: string;
  documento_id?: string;
  documento_tipo?: string;
  // Para DOCUMENTO_EMPRESA_CARGADO: título del documento de empresa.
  documento_titulo?: string;
  // Para MENSAJE_DOC_EMPRESA: fragmento del mensaje.
  mensaje_resumen?: string;
  // Para importaciones masivas: cuántos comprobantes se crearon.
  cantidad_facturas?: number;
  // Para FACTURAS_ELIMINADAS: cuántos comprobantes se eliminaron.
  cantidad_eliminadas?: number;
  // Para LIMITE_USUARIOS_REDUCIDO: nuevo límite y emails de los desactivados.
  limite_usuarios?: number;
  usuarios_desactivados?: string[];
  // Para PAGO_SUSCRIPCION_VENCIDO / EMPRESA_SUSPENDIDA_POR_PAGO: fecha de
  // vencimiento del ciclo (YYYY-MM-DD).
  fecha_vencimiento?: string;
  // Avisos de acceso: prueba exacta o ciclo pagado; no confundir con suspensión manual.
  origen_acceso?: 'PRUEBA' | 'PAGO' | 'ANTERIOR';
  etapa_acceso?: 'VENCIDO' | 'BLOQUEADO';
  ciclo_suscripcion?: string;
  acceso_hasta?: string;
}

export const notificacion = pgTable('notificacion', {
  id: uuid('id').primaryKey().defaultRandom(),
  usuarioId: uuid('usuario_id').notNull().references(() => usuario.id, { onDelete: 'cascade' }),
  tipo: tipoNotificacionEnum('tipo').notNull(),
  titulo: varchar('titulo', { length: 255 }).notNull(),
  mensaje: varchar('mensaje', { length: 500 }).notNull(),
  leida: boolean('leida').default(false).notNull(),
  metadata: jsonb('metadata').$type<MetadataNotificacion>(),
  fechaCreacion: timestamp('fecha_creacion', { withTimezone: true }).defaultNow().notNull(),
});
