import { finAccesoPago, DIAS_GRACIA_PAGO, DatosAccesoEmpresa, PagoAcceso } from '../common/acceso-empresa.util';

export type AvisoAcceso = {
  ciclo: string;
  etapa: 'VENCIDO' | 'BLOQUEADO';
  origen: 'PRUEBA' | 'PAGO' | 'ANTERIOR';
  vencimiento: Date;
  hasta: Date;
};

/** Misma vigencia que autorización: el mayor entre prueba y pago/gracia. */
export function planAvisoNuevo(emp: DatosAccesoEmpresa, pago: (PagoAcceso & { id: string }) | undefined, ahora: Date): AvisoAcceso | undefined {
  if (emp.estadoSuscripcion !== 'ACTIVO' || !emp.pruebaHasta) return;
  const finPago = pago ? finAccesoPago(pago) : undefined;
  if (!finPago || finPago <= emp.pruebaHasta) {
    if (ahora < emp.pruebaHasta) return;
    return { ciclo: `prueba:${emp.pruebaHasta.toISOString()}`, etapa: 'BLOQUEADO', origen: 'PRUEBA',
      vencimiento: emp.pruebaHasta, hasta: emp.pruebaHasta };
  }
  const vencimiento = new Date(finPago.getTime() - DIAS_GRACIA_PAGO * 86400000);
  // No avisar mientras una prueba más larga todavía cubra ese vencimiento.
  if (ahora < vencimiento || ahora < emp.pruebaHasta) return;
  return { ciclo: `pago:${pago!.id}`, etapa: ahora >= finPago ? 'BLOQUEADO' : 'VENCIDO',
    origen: 'PAGO', vencimiento, hasta: finPago };
}

export function fechaPeru(fecha: Date): string {
  return fecha.toLocaleDateString('es-PE', { timeZone: 'America/Lima' });
}
