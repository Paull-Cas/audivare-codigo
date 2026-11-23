import { BadRequestException, PayloadTooLargeException } from '@nestjs/common';
import { MAX_ARCHIVO_BYTES } from './archivo-adjunto.util';
import type { FastifyRequest } from 'fastify';

export const LIMITES_MULTIPART = {
  fileSize: MAX_ARCHIVO_BYTES,
  files: 1,
  fields: 30,
  parts: 31,
  fieldSize: 64 * 1024,
};

/** Archivo multipart con el contenido ya materializado en memoria. */
export interface ArchivoMultipart {
  filename: string;
  mimetype: string;
  buffer: Buffer;
}

export interface DatosMultipart {
  fields: Record<string, string | undefined>;
  file: ArchivoMultipart | null;
}

/** Parsea una petición multipart: campos de texto + archivo (si viene). */
export async function parseMultipart(req: FastifyRequest): Promise<DatosMultipart> {
  if (!req.isMultipart()) {
    throw new BadRequestException('La petición debe ser multipart');
  }

  const fields: Record<string, string | undefined> = {};
  let file: ArchivoMultipart | null = null;

  for await (const part of req.parts()) {
    if (part.type === 'file') {
      if (file) throw new BadRequestException('Solo se permite un archivo por petición');
      const buffer = await part.toBuffer();
      if (part.file.truncated || buffer.length > MAX_ARCHIVO_BYTES) {
        throw new PayloadTooLargeException('El archivo no debe superar 10 MB');
      }
      file = {
        filename: part.filename,
        mimetype: part.mimetype,
        buffer,
      };
    } else {
      if (part.valueTruncated) throw new BadRequestException('Un campo de texto supera el límite permitido');
      if (Object.prototype.hasOwnProperty.call(fields, part.fieldname)) {
        throw new BadRequestException('No se permiten campos de texto repetidos');
      }
      fields[part.fieldname] = typeof part.value === 'string' ? part.value : String(part.value);
    }
  }

  return { fields, file };
}
