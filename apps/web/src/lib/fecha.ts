/**
 * Formatea una fecha a "DD/MM/YYYY" de forma determinista, sin depender del
 * locale del servidor ni del navegador. Esto evita el error de hidratación de
 * React ("Text content does not match server-rendered HTML") que produce
 * `new Date(...).toLocaleDateString()` cuando el servidor (Node) y el cliente
 * usan formatos distintos. Además, al no construir un `Date`, no hay corrimiento
 * de día por zona horaria en fechas tipo "YYYY-MM-DD".
 *
 * Acepta "YYYY-MM-DD" o un ISO con hora ("YYYY-MM-DDTHH:MM:SSZ").
 */
export function fechaCorta(valor: string | null | undefined): string {
  if (!valor) return '—';
  const iso = String(valor).slice(0, 10); // "YYYY-MM-DD"
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return String(valor);
  return `${d}/${m}/${y}`;
}
