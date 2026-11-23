import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema/index.js';

// En producción la URL es obligatoria: sin ella, el fallback local haría fallar las
// conexiones con un error confuso en vez de avisar de la configuración faltante.
if (process.env.NODE_ENV === 'production' && !process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL es obligatoria en producción (cadena de conexión del Postgres administrado).');
}

const connectionString = process.env.DATABASE_URL || '';

// Disable prefetch as it is not supported for "Transaction" pool mode
export const client = postgres(connectionString, { prepare: false });
export const db = drizzle(client, { schema });

export * from './schema/index.js';
