import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { db, auditoriaOperacion } from '@audivare/database';
import { and, eq } from 'drizzle-orm';

export const UUID_VALIDO = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function recursosSeguros(params: unknown): Record<string, string> {
  const result: Record<string, string> = {};
  if (!params || typeof params !== 'object') return result;
  for (const [key, value] of Object.entries(params)) {
    if (/^[a-zA-Z][a-zA-Z0-9_]{0,39}$/.test(key) && typeof value === 'string' && UUID_VALIDO.test(value)) result[key] = value;
  }
  return result;
}
export function registrarAuditoriaHttp(server: FastifyInstance, fallo: () => void) {
  const registros = new WeakMap<object, string>();
  server.addHook('preHandler', async (req, reply) => {
    const ruta = req.routeOptions.url;
    if (!ruta || ruta === '/' || req.method === 'OPTIONS') return;
    const id = randomUUID();
    try {
      await db.insert(auditoriaOperacion).values({ id, metodo: req.method, ruta: ruta.slice(0, 255), recursos: recursosSeguros(req.params) });
      registros.set(req, id); reply.header('X-Audit-Id', id);
    } catch {
      fallo(); return reply.code(503).send({ message: 'No se puede registrar la operación. Intenta más tarde.' });
    }
  });
  server.addHook('onSend', async (req, reply, payload) => {
    const id = registros.get(req);
    if (!id) return payload;
    registros.delete(req);
    const request = req as typeof req & { user?: { id?: string; session_id?: string }; auditActor?: { id: string; session_id: string } };
    const actor = request.auditActor ?? request.user;
    try {
      await db.update(auditoriaOperacion).set({
        actorId: actor?.id && UUID_VALIDO.test(actor.id) ? actor.id : null,
        sesionId: actor?.session_id && UUID_VALIDO.test(actor.session_id) ? actor.session_id : null,
        codigoHttp: reply.statusCode, estado: 'RESPONDIDA', terminadaEn: new Date(),
      }).where(and(eq(auditoriaOperacion.id, id), eq(auditoriaOperacion.estado, 'PENDIENTE')));
    } catch {
      // El handler puede haber confirmado cambios. No inducir un reintento: la
      // intención queda durable PENDIENTE para investigar resultado desconocido.
      fallo();
    }
    return payload;
  });
}
