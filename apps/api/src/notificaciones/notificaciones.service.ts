import { Injectable } from '@nestjs/common';
import { db, notificacion, MetadataNotificacion } from '@audivare/database';
import { eq, and, desc, sql } from 'drizzle-orm';

/** Tipos del enum tipo_notificacion, inferidos del esquema. */
export type TipoNotificacion = (typeof notificacion.$inferInsert)['tipo'];

/** Conexión global o transacción en curso, para crear notificaciones dentro de una transacción. */
export type DbExecutor = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

@Injectable()
export class NotificacionesService {
  async getNotificaciones(userId: string, leida?: string) {
    const filters = [eq(notificacion.usuarioId, userId)];
    
    if (leida === 'true') {
      filters.push(eq(notificacion.leida, true));
    } else if (leida === 'false') {
      filters.push(eq(notificacion.leida, false));
    }

    const data = await db
      .select()
      .from(notificacion)
      .where(and(...filters))
      .orderBy(desc(notificacion.fechaCreacion));

    const noLeidasRes = await db
      .select({ count: sql<number>`count(*)` })
      .from(notificacion)
      .where(and(eq(notificacion.usuarioId, userId), eq(notificacion.leida, false)));

    return {
      data,
      total: data.length,
      no_leidas: Number(noLeidasRes[0].count),
    };
  }

  async marcarLeida(userId: string, id: string) {
    await db
      .update(notificacion)
      .set({ leida: true })
      .where(and(eq(notificacion.id, id), eq(notificacion.usuarioId, userId)));

    return { message: 'Notificación marcada como leída' };
  }

  async marcarTodasLeidas(userId: string) {
    await db
      .update(notificacion)
      .set({ leida: true })
      .where(eq(notificacion.usuarioId, userId));

    return { message: 'Todas las notificaciones marcadas como leídas' };
  }

  /** Único punto de creación de notificaciones; acepta la transacción en curso. */
  async crearNotificacion(
    userId: string,
    tipo: TipoNotificacion,
    titulo: string,
    mensaje: string,
    metadata: MetadataNotificacion,
    executor: DbExecutor = db,
  ) {
    await executor.insert(notificacion).values({
      usuarioId: userId,
      tipo,
      titulo,
      mensaje,
      metadata,
    });
  }
}
