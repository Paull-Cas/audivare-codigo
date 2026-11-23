import { Module } from '@nestjs/common';
import { DocumentosMensualesModule } from './documentos-mensuales/documentos-mensuales.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { FacturasModule } from './facturas/facturas.module';
import { SuperadminModule } from './superadmin/superadmin.module';
import { UsuariosModule } from './usuarios/usuarios.module';
import { ContadoresModule } from './contadores/contadores.module';
import { RolesModule } from './roles/roles.module';
import { ProveedoresModule } from './proveedores/proveedores.module';
import { PagosModule } from './pagos/pagos.module';
import { EmpresaModule } from './empresa/empresa.module';
import { DocumentosEmpresaModule } from './documentos-empresa/documentos-empresa.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { NotificacionesModule } from './notificaciones/notificaciones.module';
import { PermisosModule } from './common/permisos/permisos.module';
import { PrivacidadModule } from './privacidad/privacidad.module';

@Module({
  imports: [
    PermisosModule,
    DocumentosMensualesModule,
    PrivacidadModule,
    AuthModule,
    FacturasModule,
    SuperadminModule,
    UsuariosModule,
    ContadoresModule,
    RolesModule,
    ProveedoresModule,
    PagosModule,
    EmpresaModule,
    DocumentosEmpresaModule,
    DashboardModule,
    NotificacionesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
