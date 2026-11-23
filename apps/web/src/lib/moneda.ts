/** Símbolo de la moneda de una factura: soles por defecto, dólares si USD. */
export function simboloMoneda(moneda: string | null | undefined): string {
  return moneda === 'USD' ? 'US$' : 'S/';
}

/** Formatea un monto con el símbolo de su moneda (2 decimales). */
export function formatoMonto(monto: string | number | null | undefined, moneda?: string | null): string {
  return `${simboloMoneda(moneda)} ${Number(monto ?? 0).toFixed(2)}`;
}
