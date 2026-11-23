export const HORAS_PRUEBA = 168;
export const DIAS_GRACIA_PAGO = 7;
export type DatosAccesoEmpresa = {
  estadoSuscripcion: string | null;
  pruebaHasta?: Date | null;
};
export type PagoAcceso = { fechaPago: string; duracionMeses: number };

/** Periodos pagados por fecha calendario de Perú; fin de mes sin desbordamiento. */
export function finAccesoPago(pago: PagoAcceso): Date {
  const [y, m, d] = pago.fechaPago.split('-').map(Number);
  const finMes = new Date(Date.UTC(y, m - 1 + pago.duracionMeses + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m - 1 + pago.duracionMeses, Math.min(d, finMes) + DIAS_GRACIA_PAGO, 5));
}

export function calcularAccesoEmpresa(emp: DatosAccesoEmpresa, pago?: PagoAcceso, ahora = new Date()) {
  const manual = emp.estadoSuscripcion !== 'ACTIVO';
  // No conceder pruebas retroactivas ni alterar activaciones anteriores.
  if (!emp.pruebaHasta) return { permitido: !manual, prueba: false, hasta: null as Date | null };
  const finPago = pago ? finAccesoPago(pago) : null;
  const hasta = finPago && finPago > emp.pruebaHasta ? finPago : emp.pruebaHasta;
  const prueba = !finPago || finPago <= ahora;
  return { permitido: !manual && ahora < hasta, prueba, hasta };
}
