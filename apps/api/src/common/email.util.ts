import { BadRequestException } from '@nestjs/common';
import { promises as dns } from 'dns';

/**
 * Normaliza (trim + minúsculas) y valida un email: formato + que el dominio
 * exista y reciba correo (registros MX). La existencia del buzón exacto no es
 * verificable; la garantía final es que solo una cuenta de Google real puede
 * iniciar sesión. Lanza BadRequestException si no pasa.
 */
export async function validarEmailConDominio(emailCrudo: string): Promise<string> {
  const email = (emailCrudo || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new BadRequestException('El formato del correo no es válido');
  }

  const dominio = email.split('@')[1];
  let registrosMx: unknown[] = [];
  try {
    registrosMx = await dns.resolveMx(dominio);
  } catch {
    registrosMx = [];
  }
  if (registrosMx.length === 0) {
    throw new BadRequestException(`El dominio "${dominio}" no existe o no puede recibir correos. Revisa el correo ingresado.`);
  }

  return email;
}
