import type { FastifyInstance } from 'fastify';
import { createHash, randomUUID } from 'node:crypto';
import { rutaContableRetirada } from './rutas-retiradas';

/** Ventanas y memoria acotadas. No confía en X-Forwarded-For ni en tokens sin verificar. */
export class LimiteFrecuencia {
  private readonly ventanas = new Map<string, { hasta: number; cantidad: number }>();
  constructor(private readonly maximo: number, private readonly periodoMs: number, private readonly capacidad = 10000) {}
  admitir(clave: string, ahora = Date.now()): boolean {
    for (const [key, v] of this.ventanas) if (v.hasta <= ahora) this.ventanas.delete(key);
    let v = this.ventanas.get(clave);
    if (!v) {
      if (this.ventanas.size >= this.capacidad) return false;
      v = { hasta: ahora + this.periodoMs, cantidad: 0 }; this.ventanas.set(clave, v);
    }
    return ++v.cantidad <= this.maximo;
  }
}

export function registrarSeguridadHttp(server: FastifyInstance, registrar: (evento: string) => void) {
  const general = new LimiteFrecuencia(600, 60000), auth = new LimiteFrecuencia(120, 60000);
  const cuentas = new LimiteFrecuencia(10, 60000);
  const privacidad = new LimiteFrecuencia(60, 3600000), privacidadCorreo = new LimiteFrecuencia(5, 3600000);
  let multipartActivos = 0;
  const inicios = new WeakMap<object, { id: string; inicio: number; liberar?: () => void }>();
  server.addHook('onRequest', async (req, reply) => {
    const id = randomUUID(); inicios.set(req, { id, inicio: Date.now() });
    reply.header('X-Request-Id', id); reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('Cache-Control', 'private, no-store');
    const ruta = req.routeOptions.url ?? '';
    if (rutaContableRetirada(ruta)) return reply.code(410).send({ message: 'Esta función fue retirada. Utiliza los documentos mensuales.' });
    if (ruta === '/privacidad/solicitudes' && req.method === 'POST' && !privacidad.admitir(req.ip)) {
      reply.header('Retry-After', '3600'); return reply.code(429).send({ message: 'Se alcanzó el límite de solicitudes. Intenta más tarde.' });
    }
    if (!general.admitir(req.ip) || (ruta.startsWith('/auth/') && ruta !== '/auth/logout' && !auth.admitir(req.ip))) {
      reply.header('Retry-After', '60'); return reply.code(429).send({ message: 'Demasiadas solicitudes. Intenta nuevamente en un minuto.' });
    }
    if (req.headers['content-type']?.toLowerCase().startsWith('multipart/form-data')) {
      if (multipartActivos >= 4) {
        reply.header('Retry-After', '5'); return reply.code(429).send({ message: 'Hay subidas en curso. Intenta nuevamente en unos momentos.' });
      }
      multipartActivos++;
      let liberado = false;
      const liberar = () => { if (!liberado) { liberado = true; multipartActivos--; } };
      inicios.get(req)!.liberar = liberar;
      reply.raw.once('close', liberar); req.raw.once('aborted', liberar);
    }
  });
  server.addHook('preValidation', async (req, reply) => {
    // Las referencias de recursos son UUID; rechazar las malformadas antes de SQL.
    // `identificador` de proveedores puede ser RUC y queda fuera de esta regla.
    for (const [clave, valor] of Object.entries(req.params ?? {})) {
      if (/^(?:id|[a-zA-Z][a-zA-Z0-9_]*Id)$/.test(clave)
        && (typeof valor !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(valor))) {
        return reply.code(400).send({ message: 'Referencia inválida' });
      }
    }
    if (req.routeOptions.url === '/privacidad/solicitudes' && req.method === 'POST') {
      const solicitud = req.body as { correo?: unknown } | null;
      if (typeof solicitud?.correo === 'string' && !privacidadCorreo.admitir(createHash('sha256').update(solicitud.correo.trim().toLowerCase().slice(0,254)).digest('hex'))) {
        reply.header('Retry-After', '3600'); return reply.code(429).send({ message: 'Se alcanzó el límite de solicitudes para ese correo. Intenta más tarde.' });
      }
    }
    if (req.routeOptions.url !== '/auth/login') return;
    const body = req.body as { email?: unknown } | null;
    if (typeof body?.email !== 'string') return;
    const key = createHash('sha256').update(body.email.trim().toLowerCase().slice(0, 254)).digest('hex');
    if (!cuentas.admitir(key)) {
      reply.header('Retry-After', '60'); return reply.code(429).send({ message: 'Demasiados intentos. Intenta nuevamente en un minuto.' });
    }
  });
  server.addHook('onResponse', async (req, reply) => {
    const info = inicios.get(req);
    info?.liberar?.();
    const actor = (req as typeof req & { user?: { id?: string } }).user?.id;
    registrar(JSON.stringify({ evento: 'solicitud', id: info?.id, metodo: req.method,
      ruta: req.routeOptions.url ?? 'NO_ENCONTRADA', estado: reply.statusCode,
      duracionMs: Math.max(0, Date.now() - (info?.inicio ?? Date.now())),
      usuarioId: typeof actor === 'string' && /^[0-9a-f-]{36}$/i.test(actor) ? actor : undefined }));
  });
}
