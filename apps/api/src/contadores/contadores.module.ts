import { Module } from '@nestjs/common';
import { ContadoresController, ContadorEmpresaController } from './contadores.controller';
import { ContadoresService } from './contadores.service';
import { ExportContadorService } from './export-contador.service';
import { ImportacionService } from './importacion.service';
import { EliminacionService } from './eliminacion.service';
import { StorageModule } from '../storage/storage.module';
import { NotificacionesModule } from '../notificaciones/notificaciones.module';

@Module({
  imports: [StorageModule, NotificacionesModule],
  controllers: [ContadoresController, ContadorEmpresaController],
  providers: [ContadoresService, ExportContadorService, ImportacionService, EliminacionService],
  exports: [ExportContadorService],
})
export class ContadoresModule {}

