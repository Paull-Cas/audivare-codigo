import { Module } from '@nestjs/common';
import { DocumentosEmpresaController, ContadorDocumentosEmpresaController } from './documentos-empresa.controller';
import { DocumentosEmpresaService } from './documentos-empresa.service';
import { StorageModule } from '../storage/storage.module';
import { NotificacionesModule } from '../notificaciones/notificaciones.module';

@Module({
  imports: [StorageModule, NotificacionesModule],
  controllers: [DocumentosEmpresaController, ContadorDocumentosEmpresaController],
  providers: [DocumentosEmpresaService],
})
export class DocumentosEmpresaModule {}
