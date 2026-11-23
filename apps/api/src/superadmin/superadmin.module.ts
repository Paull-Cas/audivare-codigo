import { Module } from '@nestjs/common';
import { SuperadminController } from './superadmin.controller';
import { SuperadminService } from './superadmin.service';
import { SuscripcionesService } from './suscripciones.service';
import { NotificacionesModule } from '../notificaciones/notificaciones.module';
import { StorageModule } from '../storage/storage.module';
import { SuperadminPermisoGuard } from './superadmin-permiso.guard';

@Module({
  imports: [NotificacionesModule, StorageModule],
  controllers: [SuperadminController],
  providers: [SuperadminService, SuscripcionesService, SuperadminPermisoGuard],
})
export class SuperadminModule {}
