// Configuración sensible al entorno: "estricto afuera, cómodo adentro".
// En producción (NODE_ENV=production) los secretos son obligatorios y la API se
// niega a arrancar con los valores de desarrollo (fail-fast, antes de aceptar
// tráfico). En local se mantienen los defaults de siempre para no romper el flujo.

/** Valor de desarrollo del JWT. Es público (está en el repo): NUNCA válido en producción. */
const JWT_SECRET_DEV = 'public-review-placeholder-not-a-secret';

export const esProduccion = (): boolean => process.env.NODE_ENV === 'production';

export function getGoogleClientId(): string {
  const id = process.env.GOOGLE_CLIENT_ID;
  if (esProduccion() && (!id || !/^[a-zA-Z0-9-]+\.apps\.googleusercontent\.com$/.test(id))) {
    throw new Error('GOOGLE_CLIENT_ID válido es obligatorio en producción');
  }
  return id || '';
}

/**
 * Secreto de firma/verificación del JWT. Debe ser idéntico al de la web
 * (su middleware verifica la firma del token con el mismo valor).
 */
export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;

  if (esProduccion()) {
    if (!secret) {
      throw new Error(
        'JWT_SECRET es obligatorio en producción. Genera un valor aleatorio de 32+ caracteres y configúralo en las variables de entorno (el mismo en la API y en la web).',
      );
    }
    if (secret === JWT_SECRET_DEV) {
      throw new Error(
        'JWT_SECRET está usando el valor de desarrollo, que es público (está en el repositorio). Con él cualquiera podría falsificar un token de superadmin. Genera uno propio para producción.',
      );
    }
    if (secret.length < 32) {
      throw new Error('JWT_SECRET es demasiado corto: usa al menos 32 caracteres aleatorios.');
    }
    return secret;
  }

  return secret || JWT_SECRET_DEV;
}

/**
 * Orígenes permitidos por CORS. El navegador solo habla con la web (que llama a
 * la API desde el servidor), así que en producción CORS queda cerrado salvo que
 * se declaren orígenes explícitos en CORS_ORIGINS (separados por coma).
 */
export function getCorsOrigin(): string[] | boolean {
  if (!esProduccion()) return true; // local: permite localhost:3000 como hasta ahora

  const origins = process.env.CORS_ORIGINS?.split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  if (origins?.some(origin => {
    try { const url = new URL(origin); return url.protocol !== 'https:' || url.origin !== origin || !!url.username || !!url.password; }
    catch { return true; }
  })) throw new Error('CORS_ORIGINS debe contener solo orígenes HTTPS explícitos');

  return origins?.length ? origins : false;
}

/** Puerto de escucha. Los hosts (Railway, etc.) lo inyectan por PORT; en local es 3001. */
export function getPort(): number {
  return Number(process.env.PORT) || 3001;
}
