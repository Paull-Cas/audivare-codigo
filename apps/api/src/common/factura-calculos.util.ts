import { BadRequestException } from '@nestjs/common';
import { monedaFacturaEnum } from '@audivare/database';

export type MonedaFactura = (typeof monedaFacturaEnum.enumValues)[number];

export function validarMoneda(valor: string): MonedaFactura {
  if (!(monedaFacturaEnum.enumValues as readonly string[]).includes(valor)) {
    throw new BadRequestException(
      `La moneda '${valor}' no es válida. Valores permitidos: ${monedaFacturaEnum.enumValues.join(', ')}`,
    );
  }
  return valor as MonedaFactura;
}

/** Símbolo monetario para mensajes, eventos del historial y exports. */
export function simboloMoneda(moneda: string | null | undefined): string {
  return moneda === 'USD' ? 'US$' : 'S/';
}
