import type { FastifyRequest } from 'fastify';
import { tipoUsuarioEnum } from '@audivare/database';

export type TipoUsuario = (typeof tipoUsuarioEnum.enumValues)[number];

/** Payload del JWT emitido en el login. */
export interface JwtPayload {
  sub: string;
  sid: string;
  exp: number;
  email: string;
  tipo_usuario: TipoUsuario;
}

/** Usuario autenticado que JwtStrategy adjunta a request.user. */
export interface UsuarioAutenticado {
  id: string;
  session_id: string;
  email: string;
  tipo_usuario: TipoUsuario;
}

/** Request de Fastify tras pasar por JwtAuthGuard. */
export interface RequestConUsuario extends FastifyRequest {
  user: UsuarioAutenticado;
}
