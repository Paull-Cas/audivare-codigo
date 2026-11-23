import { BadRequestException } from '@nestjs/common';
import { estadoFacturaEnum } from '@audivare/database';

export type EstadoFactura = (typeof estadoFacturaEnum.enumValues)[number];

export function esEstadoFactura(valor: string): valor is EstadoFactura {
  return (estadoFacturaEnum.enumValues as readonly string[]).includes(valor);
}

/** Valida el filtro `estado` recibido por query antes de usarlo en la consulta (400 en vez de error del driver). */
export function validarEstadoFactura(estado: string): EstadoFactura {
  if (!esEstadoFactura(estado)) {
    throw new BadRequestException(
      `El estado '${estado}' no es válido. Valores permitidos: ${estadoFacturaEnum.enumValues.join(', ')}`,
    );
  }
  return estado;
}
