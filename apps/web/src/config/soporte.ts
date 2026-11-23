// Contacto de SOPORTE de la plataforma (el equipo de AudiVare) para consultas
// de los usuarios. Se muestra en el botón "Asistencia" del sidebar en todos los
// roles. Distinto de `contacto.ts` (que es el contador/socio para regularizar el
// pago de una empresa pendiente/suspendida).
//
// PARA CAMBIARLO: edita los valores por defecto o define NEXT_PUBLIC_SOPORTE_*
// en apps/web/.env.local (tienen prioridad).

export const SOPORTE = {
  nombre: process.env.NEXT_PUBLIC_SOPORTE_NOMBRE || '',
  email: process.env.NEXT_PUBLIC_SOPORTE_EMAIL || '',
  telefono: process.env.NEXT_PUBLIC_SOPORTE_TELEFONO || '',
};

/** Enlace a WhatsApp (wa.me) con el número normalizado y un mensaje opcional. */
export function soporteWhatsappUrl(mensaje?: string): string {
  const soloDigitos = SOPORTE.telefono.replace(/\D/g, '');
  const texto = mensaje ? `?text=${encodeURIComponent(mensaje)}` : '';
  return `https://wa.me/${soloDigitos}${texto}`;
}

/** Enlace mailto con asunto opcional. */
export function soporteEmailUrl(asunto?: string): string {
  const sub = asunto ? `?subject=${encodeURIComponent(asunto)}` : '';
  return `mailto:${SOPORTE.email}${sub}`;
}
