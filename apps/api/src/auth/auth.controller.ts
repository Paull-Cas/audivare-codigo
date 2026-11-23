import { Controller, Post, Body, ValidationPipe, UsePipes, Headers, BadRequestException, Req } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { UUID_VALIDO } from '../privacidad/auditoria-http';
import { AuthService } from './auth.service';
import { GoogleLoginDto, GoogleRegistroDto } from './google-auth.dto';
import { SesionesService } from './sesiones.service';

type SolicitudAuditable = FastifyRequest & { auditActor?: { id: string; session_id: string } };
// Solo resultados emitidos por AuthService, nunca tokens de entrada ni headers.
function marcarLogin(req: SolicitudAuditable, result: unknown) {
  if (!result || typeof result !== 'object' || !('access_token' in result) || typeof result.access_token !== 'string') return;
  try {
    const p: unknown = JSON.parse(Buffer.from(result.access_token.split('.')[1], 'base64url').toString());
    if (p && typeof p === 'object' && 'sub' in p && 'sid' in p && typeof p.sub === 'string' && typeof p.sid === 'string'
      && UUID_VALIDO.test(p.sub) && UUID_VALIDO.test(p.sid)) req.auditActor = { id: p.sub, session_id: p.sid };
  } catch { /* Un resultado sin sesión no se atribuye a un actor. */ }
}

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService, private sesionesService: SesionesService) {}

  @Post('logout')
  async logout(@Req() req: SolicitudAuditable, @Headers('authorization') authorization?: string) {
    const match = authorization?.match(/^Bearer\s+(\S+)$/i);
    return this.sesionesService.revocarToken(match?.[1], actor => { req.auditActor = actor; });
  }

  @Post('login')
  async login(@Body() body: { email: string; password: string }, @Req() req: SolicitudAuditable) {
    if (!body || typeof body.email !== 'string' || typeof body.password !== 'string'
      || body.email.length > 254 || body.password.length > 128 || !body.password.length
      || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) throw new BadRequestException('Correo o contraseña inválidos');
    const result = await this.authService.login(body.email, body.password); marcarLogin(req, result); return result;
  }

  @Post('google/login')
  @UsePipes(new ValidationPipe({ transform: true }))
  async googleLogin(@Body() dto: GoogleLoginDto, @Req() req: SolicitudAuditable) {
    const result = await this.authService.googleLogin(dto); marcarLogin(req, result); return result;
  }

  @Post('google/registro')
  @UsePipes(new ValidationPipe({ transform: true }))
  async googleRegistro(@Body() dto: GoogleRegistroDto, @Req() req: SolicitudAuditable) {
    const result = await this.authService.googleRegistro(dto); marcarLogin(req, result); return result;
  }
}
