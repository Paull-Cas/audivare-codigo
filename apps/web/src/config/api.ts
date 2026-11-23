/** Preview utiliza un backend separado; nunca hereda silenciosamente el de producción. */
export function getApiUrl(): string {
  const preview = process.env.VERCEL_ENV === 'preview';
  const value = preview ? process.env.PREVIEW_API_URL : process.env.API_URL;
  if ((process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV) && !value) throw new Error('API_URL del entorno es obligatoria; Preview requiere PREVIEW_API_URL');
  const raw = value || 'http://127.0.0.1:3001';
  const url = new URL(raw);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('API_URL debe utilizar HTTP o HTTPS');
  if (url.username || url.password || url.search || url.hash || (url.pathname !== '/' && url.pathname !== '')) throw new Error('API_URL debe ser un origen sin credenciales ni ruta');
  if (process.env.VERCEL_ENV && url.protocol !== 'https:') throw new Error('API_URL debe utilizar HTTPS en Vercel');
  if (preview && process.env.API_URL && url.origin === new URL(process.env.API_URL).origin) throw new Error('Preview requiere una API independiente de producción');
  return url.origin;
}
