import { Module } from '@nestjs/common';
import { PrivacidadService } from './privacidad.service';
import { PrivacidadAdminController, PrivacidadPublicaController } from './privacidad.controller';
@Module({ controllers: [PrivacidadAdminController, PrivacidadPublicaController], providers: [PrivacidadService] })
export class PrivacidadModule {}
