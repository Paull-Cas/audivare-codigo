import { BadRequestException } from '@nestjs/common';
import { tipoDocumentoEnum, tipoPagoEnum } from '@audivare/database';

export type TipoDocumento = (typeof tipoDocumentoEnum.enumValues)[number];

/** Valida un tipo de documento recibido como string antes de insertarlo (400 en vez de error del driver). */
export function validarTipoDocumento(valor: string): TipoDocumento {
  if (!(tipoDocumentoEnum.enumValues as readonly string[]).includes(valor)) {
    throw new BadRequestException(
      `El tipo de documento '${valor}' no es válido. Valores permitidos: ${tipoDocumentoEnum.enumValues.join(', ')}`,
    );
  }
  return valor as TipoDocumento;
}

export type TipoPago = (typeof tipoPagoEnum.enumValues)[number];

/** Valida el tipo de pago (NORMAL/DETRACCION). Vacío/ausente → NORMAL por defecto. */
export function validarTipoPago(valor?: string): TipoPago {
  if (!valor) return 'NORMAL';
  if (!(tipoPagoEnum.enumValues as readonly string[]).includes(valor)) {
    throw new BadRequestException(
      `El tipo de pago '${valor}' no es válido. Valores permitidos: ${tipoPagoEnum.enumValues.join(', ')}`,
    );
  }
  return valor as TipoPago;
}
