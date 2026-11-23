// Rechazar la entrada completa evita convertir un importe pegado inválido en otro monto.
export function entradaFactura(campo: string, entrada: string): string | null {
  if (campo === 'numero' || campo === 'proveedorRuc') {
    const limite = campo === 'proveedorRuc' ? 11 : 20;
    return new RegExp(`^\\d{0,${limite}}$`).test(entrada) ? entrada : null;
  }
  if (campo === 'serie') return /^[A-Za-z0-9]{0,20}$/.test(entrada) ? entrada.toUpperCase() : null;
  if (['montoTotal', 'baseImponible', 'igv'].includes(campo)) {
    const valor = entrada.replace(',', '.');
    return /^\d{0,10}(\.\d{0,2})?$/.test(valor) ? valor : null;
  }
  return entrada;
}

export function patronFactura(campo: string): string | undefined {
  if (campo === 'numero') return '[0-9]{1,20}';
  if (campo === 'proveedorRuc') return '[0-9]{11}';
  if (campo === 'serie') return '[A-Za-z0-9]{1,20}';
  if (['montoTotal', 'baseImponible', 'igv'].includes(campo)) return '[0-9]{1,10}([.][0-9]{1,2})?';
  return undefined;
}
