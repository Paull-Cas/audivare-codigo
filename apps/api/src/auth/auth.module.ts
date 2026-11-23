import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { LegalController } from './legal.controller';
import { JwtStrategy } from './jwt.strategy';
import { SesionesService } from './sesiones.service';
import { NotificacionesModule } from '../notificaciones/notificaciones.module';
import { getJwtSecret } from '../common/config';

@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: getJwtSecret(),
    }),
    NotificacionesModule,
  ],
  providers: [AuthService, JwtStrategy, SesionesService],
  controllers: [AuthController, LegalController],
  exports: [AuthService],
})
export class AuthModule {}
