import { Module } from "@nestjs/common";
import { DocumentosMensualesController } from "./documentos-mensuales.controller";
import { DocumentosMensualesService } from "./documentos-mensuales.service";
import { PdfMensualService } from "./pdf-mensual.service";
import { StorageModule } from "../storage/storage.module";
import { NotificacionesModule } from "../notificaciones/notificaciones.module";
@Module({
  imports: [StorageModule, NotificacionesModule],
  controllers: [DocumentosMensualesController],
  providers: [DocumentosMensualesService, PdfMensualService],
})
export class DocumentosMensualesModule {}
