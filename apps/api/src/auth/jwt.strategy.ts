import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';
import { JwtPayload, UsuarioAutenticado } from '../common/tipos';
import { getJwtSecret } from '../common/config';
import { SesionesService, JWT_ISSUER, JWT_AUDIENCE } from './sesiones.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly sesionesService: SesionesService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      algorithms: ['HS256'],
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
      secretOrKey: getJwtSecret(),
    });
  }

  async validate(payload: JwtPayload): Promise<UsuarioAutenticado> {
    return this.sesionesService.validar(payload);
  }
}
