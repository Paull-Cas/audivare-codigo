import { BadRequestException } from '@nestjs/common';
import { fromBuffer, Entry } from 'yauzl';
import { Worker } from 'node:worker_threads';
import { join } from 'node:path';
import { LIMITES_TRABAJO } from '../common/limites-trabajo';

/** Cuenta bytes realmente descomprimidos, no solo el tamaño declarado en el ZIP. */
export function validarZipExcel(buffer: Buffer): Promise<void> {
  return new Promise((resolve, reject) => {
    fromBuffer(buffer, { lazyEntries: true, validateEntrySizes: true, strictFileNames: true }, (error, zip) => {
      if (error || !zip) { reject(new BadRequestException('Excel inválido')); return; }
      let bytes = 0, entradas = 0, terminado = false;
      const nombres = new Set<string>();
      const timer = setTimeout(() => fallar(), LIMITES_TRABAJO.tiempoExcelMs);
      const fallar = () => {
        if (terminado) return;
        terminado = true; clearTimeout(timer); zip.close();
        reject(new BadRequestException('Excel inválido o supera los límites de descompresión (50 MB, 128 entradas).'));
      };
      zip.on('error', fallar);
      zip.on('end', () => {
        if (terminado) return;
        terminado = true; clearTimeout(timer);
        if (!nombres.has('xl/workbook.xml') || !nombres.has('[Content_Types].xml')) reject(new BadRequestException('El archivo no es un Excel XLSX'));
        else resolve();
      });
      zip.on('entry', (entry: Entry) => {
        if (terminado) return;
        if (++entradas > LIMITES_TRABAJO.entradasZip || nombres.has(entry.fileName) || entry.generalPurposeBitFlag & 1
          || entry.uncompressedSize > LIMITES_TRABAJO.excelBytes - bytes) { fallar(); return; }
        nombres.add(entry.fileName);
        zip.openReadStream(entry, (err, stream) => {
          if (err || !stream) { fallar(); return; }
          stream.on('error', fallar);
          stream.on('data', (chunk: Buffer) => {
            bytes += chunk.length;
            if (terminado || bytes > LIMITES_TRABAJO.excelBytes) { stream.destroy(); fallar(); }
          });
          stream.on('end', () => { if (!terminado) zip.readEntry(); });
        });
      });
      zip.readEntry();
    });
  });
}

export async function leerExcelSeguro(buffer: Buffer): Promise<string[][]> {
  await validarZipExcel(buffer);
  return new Promise((resolve, reject) => {
    const worker = new Worker(join(__dirname, 'excel.worker.js'), { workerData: buffer,
      resourceLimits: { maxOldGenerationSizeMb: 128, maxYoungGenerationSizeMb: 16 } });
    let terminado = false;
    const finalizar = (error?: string, filas?: string[][]) => {
      if (terminado) return;
      terminado = true; clearTimeout(timer); void worker.terminate();
      if (error || !filas) reject(new BadRequestException(error || 'Excel inválido o demasiado complejo'));
      else resolve(filas);
    };
    const timer = setTimeout(() => finalizar('El Excel supera el tiempo permitido. Divide el archivo.'), LIMITES_TRABAJO.tiempoExcelMs);
    worker.on('message', (resultado: { filas?: string[][]; error?: string }) => finalizar(resultado.error, resultado.filas));
    worker.on('error', () => finalizar('Excel inválido o demasiado complejo'));
    worker.on('exit', () => { if (!terminado) finalizar('No se pudo leer el Excel'); });
  });
}
