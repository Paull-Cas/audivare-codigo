// Secreto con el que el middleware verifica la firma del JWT. Debe ser EXACTAMENTE
// el mismo que usa la API para firmarlo; si no coinciden, ningún usuario podrá entrar.
//
// Mismo criterio que la API: en producción es obligatorio y propio (fail-fast);
// en local se mantiene el valor de desarrollo de siempre.

/** Valor de desarrollo. Es público (está en el repo): NUNCA válido en producción. */
const JWT_SECRET_DEV = 'public-review-placeholder-not-a-secret';

export function getJwtSecret(): string {
  const preview = process.env.VERCEL_ENV === 'preview';
  const secret = preview ? process.env.PREVIEW_JWT_SECRET : process.env.JWT_SECRET;
  if (preview && (!secret || secret === process.env.JWT_SECRET)) throw new Error('Preview requiere PREVIEW_JWT_SECRET independiente de producción');

  if (process.env.NODE_ENV === 'production') {
    if (!secret) {
      throw new Error(
        'JWT_SECRET es obligatorio en producción. Configúralo con el mismo valor que en la API.',
      );
    }
    if (secret === JWT_SECRET_DEV) {
      throw new Error(
        'JWT_SECRET está usando el valor de desarrollo, que es público. Genera uno propio y úsalo en la API y en la web.',
      );
    }
    if (secret.length < 32) throw new Error('JWT_SECRET debe tener al menos 32 caracteres en producción');
    return secret;
  }

  return secret || JWT_SECRET_DEV;
}
