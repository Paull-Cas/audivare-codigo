// Datos de contacto que se muestran al usuario cuando su empresa no tiene
// acceso (pendiente de activación o suspendida), para que coordine la
// activación de su cuenta.
//
// PARA CAMBIARLOS: edita los valores de abajo (son públicos por diseño: se le
// muestran a cualquiera). Las variables NEXT_PUBLIC_CONTACTO_* siguen teniendo
// prioridad si algún día hace falta un contacto distinto por entorno.
// Cuando se automatice el cobro con pasarela de pago, este contacto se puede
// reemplazar por el flujo de pago en línea.

export const CONTACTO_CONTADOR = {
  nombre: process.env.NEXT_PUBLIC_CONTACTO_NOMBRE || '',
  email: process.env.NEXT_PUBLIC_CONTACTO_EMAIL || '',
  telefono: process.env.NEXT_PUBLIC_CONTACTO_TELEFONO || '',
};

/** Enlace a WhatsApp (wa.me) con el número normalizado y un mensaje opcional. */
export function whatsappUrl(mensaje?: string): string {
  const soloDigitos = CONTACTO_CONTADOR.telefono.replace(/\D/g, '');
  const texto = mensaje ? `?text=${encodeURIComponent(mensaje)}` : '';
  return `https://wa.me/${soloDigitos}${texto}`;
}

/** Enlace mailto con asunto opcional. */
export function emailUrl(asunto?: string): string {
  const sub = asunto ? `?subject=${encodeURIComponent(asunto)}` : '';
  return `mailto:${CONTACTO_CONTADOR.email}${sub}`;
}
