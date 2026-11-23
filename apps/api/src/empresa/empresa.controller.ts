import { Controller, Get, Patch, Body, Request, UseGuards } from '@nestjs/common';
import { EmpresaService } from './empresa.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { RequestConUsuario } from '../common/tipos';
import { PermisosGuard } from '../common/permisos/permisos.guard';
import { RequierePermiso } from '../common/permisos/requiere-permiso.decorator';

@UseGuards(JwtAuthGuard, PermisosGuard)
@Controller('empresa')
export class EmpresaController {
  constructor(private readonly empresaService: EmpresaService) {}

  @Get()
  async getEmpresa(@Request() req: RequestConUsuario) {
    return this.empresaService.getEmpresa(req.user.id);
  }

  @Patch()
  @RequierePermiso('USUARIO_MANAGE')
  async updateEmpresa(
    @Request() req: RequestConUsuario,
    @Body() body: { razon_social?: string }
  ) {
    return this.empresaService.updateEmpresa(req.user.id, body);
  }
}
