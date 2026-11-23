import { Module } from '@nestjs/common';
import { FacturasController } from './facturas.controller';
import { ContadorFacturasController } from './contador-facturas.controller';
import { FacturasService } from './facturas.service';
import { StorageModule } from '../storage/storage.module';
import { NotificacionesModule } from '../notificaciones/notificaciones.module';
import { ContadoresModule } from '../contadores/contadores.module';

@Module({
  imports: [StorageModule, NotificacionesModule, ContadoresModule],
  controllers: [FacturasController, ContadorFacturasController],
  providers: [FacturasService],
})
export class FacturasModule {}
