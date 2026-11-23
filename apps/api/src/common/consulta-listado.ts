import { BadRequestException } from '@nestjs/common';

/** Parámetros acotados; los comodines escritos por el usuario se buscan literalmente. */
export function busquedaListado(valor: unknown): string {
  if (valor === undefined) return '';
  if (typeof valor !== 'string' || valor.length > 200 || /[\x00-\x1f]/.test(valor))
    throw new BadRequestException('La búsqueda debe ser texto de hasta 200 caracteres');
  return valor.trim();
}
export function patronBusqueda(texto: string): string {
  return `%${texto.replace(/[\\%_]/g, '\\$&')}%`;
}
export function paginaListado(valor: unknown): number {
  if (valor === undefined) return 1;
  const pagina = typeof valor === 'number' ? valor
    : typeof valor === 'string' && /^\d+$/.test(valor) ? Number(valor) : NaN;
  if (!Number.isInteger(pagina) || pagina < 1 || pagina > 100000)
    throw new BadRequestException('Página inválida');
  return pagina;
}
