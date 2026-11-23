import { HttpException, BadRequestException } from '@nestjs/common';
import { LimiteFrecuencia } from './seguridad-http';

export const LIMITES_TRABAJO = {
  filas: 5000, columnas: 128, celda: 2000, archivo: 10 * 1024 * 1024,
  excelBytes: 50 * 1024 * 1024, entradasZip: 128, tiempoExcelMs: 30000,
  documentosExport: 10000, archivosZip: 200, bytesZip: 100 * 1024 * 1024,
};

export function validarFilas(filas: string[][]): void {
  if (filas.length > LIMITES_TRABAJO.filas + 1) throw new BadRequestException('Máximo 5000 filas por importación. Divide el archivo.');
  for (const fila of filas) {
    if (fila.length > LIMITES_TRABAJO.columnas) throw new BadRequestException(`Máximo ${LIMITES_TRABAJO.columnas} columnas por importación`);
    if (fila.some(c => c.length > LIMITES_TRABAJO.celda)) throw new BadRequestException('Una celda supera 2000 caracteres');
  }
}

/** Protección local de memoria; compartida por todas las instancias del servicio en este proceso. */
export class CupoTrabajo {
  private activos = 0;
  constructor(private readonly maximo: number) {}
  adquirir(): () => void {
    if (this.activos >= this.maximo) throw new HttpException('Hay operaciones en curso. Intenta nuevamente en unos momentos.', 429);
    this.activos++;
    let liberado = false;
    return () => { if (!liberado) { liberado = true; this.activos--; } };
  }
}
export const cupoImportacion = new CupoTrabajo(2);
export const cupoExportacion = new CupoTrabajo(2);
const frecuenciaImportacion = new LimiteFrecuencia(10, 60000);
const frecuenciaExportacion = new LimiteFrecuencia(6, 60000);
export function controlarFrecuenciaTrabajo(tipo: 'importacion' | 'exportacion', identidad: string): void {
  if (!(tipo === 'importacion' ? frecuenciaImportacion : frecuenciaExportacion).admitir(identidad)) {
    throw new HttpException('Has alcanzado el límite de operaciones. Intenta nuevamente en un minuto.', 429);
  }
}
