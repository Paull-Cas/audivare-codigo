import { parentPort, workerData } from 'node:worker_threads';
import * as ExcelJS from 'exceljs';
import { LIMITES_TRABAJO, validarFilas } from '../common/limites-trabajo';

function texto(valor: ExcelJS.CellValue): string {
  if (valor == null) return '';
  if (valor instanceof Date) return `${String(valor.getUTCDate()).padStart(2, '0')}/${String(valor.getUTCMonth() + 1).padStart(2, '0')}/${valor.getUTCFullYear()}`;
  if (typeof valor === 'object') {
    if ('text' in valor) return String(valor.text ?? '');
    if ('result' in valor) return String(valor.result ?? '');
    if ('richText' in valor) return valor.richText.map(t => t.text).join('');
    return '';
  }
  return String(valor);
}
async function leer() {
  try {
    const libro = new ExcelJS.Workbook();
    const buffer = Buffer.from(workerData as Uint8Array);
    await libro.xlsx.load(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer);
    const hoja = libro.worksheets[0];
    if (!hoja) throw new Error();
    if (hoja.rowCount > LIMITES_TRABAJO.filas + 1 || hoja.columnCount > LIMITES_TRABAJO.columnas) throw new Error();
    const filas: string[][] = [];
    hoja.eachRow(fila => {
      const celdas: string[] = [];
      for (let i = 1; i <= hoja.columnCount; i++) celdas.push(texto(fila.getCell(i).value));
      filas.push(celdas);
    });
    validarFilas(filas);
    parentPort?.postMessage({ filas });
  } catch { parentPort?.postMessage({ error: 'Excel inválido o supera los límites: 5000 filas, 64 columnas, 2000 caracteres por celda.' }); }
}
void leer();
