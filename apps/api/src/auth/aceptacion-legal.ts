import { BadRequestException, ConflictException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { db, documentoLegal, aceptacionLegal } from '@audivare/database';
import { RESPONSABLE_AUDIVARE, TERMINOS_AUDIVARE, PRIVACIDAD_AUDIVARE } from '@audivare/database/legal';
import { and, eq } from 'drizzle-orm';
import type { DbExecutor } from '../notificaciones/notificaciones.service';

export const VERSION_LEGAL = TERMINOS_AUDIVARE.version;
export const CONTENIDO_LEGAL = JSON.stringify({ responsable: RESPONSABLE_AUDIVARE,
  terminos: TERMINOS_AUDIVARE, privacidad: PRIVACIDAD_AUDIVARE });
export const HASH_LEGAL = createHash('sha256').update(CONTENIDO_LEGAL, 'utf8').digest('hex');

export function validarAceptacionLegal(body: unknown) {
  if (!body || typeof body !== 'object') throw new BadRequestException('Debes revisar y aceptar los términos');
  const b = body as Record<string, unknown>;
  if (b.acepta_terminos !== true || b.privacidad_leida !== true) {
    throw new BadRequestException('Marca la aceptación de términos y la lectura de la política de privacidad');
  }
  if (b.version_legal !== VERSION_LEGAL) {
    throw new ConflictException('Las condiciones cambiaron. Recarga la página y revísalas antes de continuar');
  }
}

export async function registrarAceptacionLegal(executor: DbExecutor, usuarioId: string,
  empresaId: string | null, origen: 'REGISTRO' | 'REVISION') {
  await executor.insert(documentoLegal).values({ version: VERSION_LEGAL, sha256: HASH_LEGAL, contenido: CONTENIDO_LEGAL })
    .onConflictDoNothing({ target: documentoLegal.version });
  const [documento] = await executor.select().from(documentoLegal).where(eq(documentoLegal.version, VERSION_LEGAL));
  if (!documento || documento.sha256 !== HASH_LEGAL || documento.contenido !== CONTENIDO_LEGAL) {
    throw new ConflictException('La versión legal no coincide con su texto archivado. Contacta al responsable');
  }
  await executor.insert(aceptacionLegal).values({ usuarioId, empresaId, documentoId: documento.id, origen,
    representaEmpresa: empresaId !== null }).onConflictDoNothing({ target: [aceptacionLegal.usuarioId, aceptacionLegal.documentoId] });
  const [registro] = await executor.select().from(aceptacionLegal)
    .where(and(eq(aceptacionLegal.usuarioId, usuarioId), eq(aceptacionLegal.documentoId, documento.id)));
  return { version: VERSION_LEGAL, sha256: HASH_LEGAL, aceptada_en: registro.aceptadaEn,
    representa_empresa: registro.representaEmpresa };
}

export async function estadoAceptacionLegal(usuarioId: string) {
  const [registro] = await db.select({ fecha: aceptacionLegal.aceptadaEn, representaEmpresa: aceptacionLegal.representaEmpresa })
    .from(aceptacionLegal).innerJoin(documentoLegal, eq(aceptacionLegal.documentoId, documentoLegal.id))
    .where(and(eq(aceptacionLegal.usuarioId, usuarioId), eq(documentoLegal.version, VERSION_LEGAL), eq(documentoLegal.sha256, HASH_LEGAL)));
  return { version: VERSION_LEGAL, aceptada_en: registro?.fecha ?? null,
    representa_empresa: registro?.representaEmpresa ?? false };
}
