import { BadRequestException, PayloadTooLargeException } from '@nestjs/common';
import { extname } from 'node:path';
import type { ArchivoMultipart } from './multipart.util';

export const MAX_ARCHIVO_BYTES = 10 * 1024 * 1024;

/** Contrasta firma y estructura mínima; no sustituye análisis de malware. */
export function validarAdjunto(file: ArchivoMultipart): { extension: string; mimetype: string } {
  const buffer = file.buffer;
  if (buffer.length > MAX_ARCHIVO_BYTES) {
    throw new PayloadTooLargeException('El archivo no debe superar 10 MB');
  }
  if (!buffer.length) throw new BadRequestException('El archivo está vacío');
  if (!file.filename || file.filename.length > 255 || /[\x00-\x1f\x7f/\\]/.test(file.filename)) {
    throw new BadRequestException('El nombre del archivo no es válido');
  }
  const extension = extname(file.filename).toLowerCase();
  let mimetype: string | undefined;
  if (extension === '.pdf' && /^%PDF-1\.[0-7]|^%PDF-2\.0/.test(buffer.subarray(0, 8).toString('ascii')) &&
      /%%EOF\s*$/.test(buffer.subarray(-1024).toString('latin1'))) {
    mimetype = 'application/pdf';
  } else if (extension === '.png' && esPng(buffer)) {
    mimetype = 'image/png';
  } else if (['.jpg', '.jpeg'].includes(extension) && esJpeg(buffer)) {
    mimetype = 'image/jpeg';
  }
  if (!mimetype || file.mimetype.toLowerCase() !== mimetype) {
    throw new BadRequestException('Solo se permiten PDF, PNG o JPEG cuyo contenido, extensión y tipo coincidan');
  }
  return { extension, mimetype };
}

function esJpeg(buffer: Buffer): boolean {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) return false;
  let offset = 2;
  let tieneMarco = false;
  let tieneScan = false;
  while (offset < buffer.length) {
    if (buffer[offset++] !== 0xff) return false;
    while (buffer[offset] === 0xff) offset++;
    const marker = buffer[offset++];
    if (marker === 0xd9) return tieneMarco && tieneScan && offset === buffer.length;
    if (offset + 2 > buffer.length) return false;
    const length = buffer.readUInt16BE(offset);
    if (length < 2 || offset + length > buffer.length) return false;
    if ([0xc0, 0xc1, 0xc2].includes(marker)) {
      if (length < 8 || buffer.readUInt16BE(offset + 3) === 0 || buffer.readUInt16BE(offset + 5) === 0) return false;
      tieneMarco = true;
    }
    offset += length;
    if (marker === 0xda) {
      if (!tieneMarco || length < 6) return false;
      tieneScan = true;
      // Bytes de imagen, escape FF00 y marcadores de reinicio.
      while (offset < buffer.length) {
        if (buffer[offset] !== 0xff) { offset++; continue; }
        const next = buffer[offset + 1];
        if (next === 0x00 || (next >= 0xd0 && next <= 0xd7)) { offset += 2; continue; }
        break;
      }
    }
  }
  return false;
}

function esPng(buffer: Buffer): boolean {
  if (buffer.length < 45 || !buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return false;
  let offset = 8;
  let tieneDatos = false;
  while (offset + 12 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    if (length > buffer.length - offset - 12) return false;
    const tipo = buffer.toString('ascii', offset + 4, offset + 8);
    if (offset === 8 && (tipo !== 'IHDR' || length !== 13 ||
        buffer.readUInt32BE(offset + 8) === 0 || buffer.readUInt32BE(offset + 12) === 0)) return false;
    if (tipo === 'IDAT' && length > 0) tieneDatos = true;
    offset += length + 12;
    if (tipo === 'IEND') return length === 0 && tieneDatos && offset === buffer.length;
  }
  return false;
}
