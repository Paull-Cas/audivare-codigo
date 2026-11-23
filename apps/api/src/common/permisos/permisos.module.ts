import { Global, Module } from '@nestjs/common';
import { PermisosService } from './permisos.service';
import { PermisosGuard } from './permisos.guard';

@Global()
@Module({
  providers: [PermisosService, PermisosGuard],
  exports: [PermisosService, PermisosGuard],
})
export class PermisosModule {}
