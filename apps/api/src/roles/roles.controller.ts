import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, Request } from '@nestjs/common';
import { RolesService } from './roles.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { RequestConUsuario } from '../common/tipos';
import { PermisosGuard } from '../common/permisos/permisos.guard';
import { RequierePermiso } from '../common/permisos/requiere-permiso.decorator';

@Controller('roles')
@UseGuards(JwtAuthGuard, PermisosGuard)
@RequierePermiso('ROL_MANAGE')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  getRoles(@Request() req: RequestConUsuario) {
    return this.rolesService.getRoles(req.user.id);
  }

  @Post()
  createRol(
    @Request() req: RequestConUsuario,
    @Body('nombre_rol') nombreRol: string,
    @Body('descripcion') descripcion: string,
    @Body('permisos') permisos: string[],
  ) {
    return this.rolesService.createRol(req.user.id, { nombre_rol: nombreRol, descripcion, permisos: permisos || [] });
  }

  @Patch(':id')
  updateRol(
    @Request() req: RequestConUsuario,
    @Param('id') id: string,
    @Body('nombre_rol') nombreRol: string,
    @Body('descripcion') descripcion: string,
    @Body('permisos') permisos: string[],
  ) {
    return this.rolesService.updateRol(req.user.id, id, { nombre_rol: nombreRol, descripcion, permisos: permisos || [] });
  }

  @Delete(':id')
  deleteRol(
    @Request() req: RequestConUsuario,
    @Param('id') id: string,
  ) {
    return this.rolesService.deleteRol(req.user.id, id);
  }
}
