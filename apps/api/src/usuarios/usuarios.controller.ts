import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, Request } from '@nestjs/common';
import { UsuariosService } from './usuarios.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { RequestConUsuario } from '../common/tipos';
import { PermisosGuard } from '../common/permisos/permisos.guard';
import { RequierePermiso } from '../common/permisos/requiere-permiso.decorator';

@Controller('usuarios')
@UseGuards(JwtAuthGuard, PermisosGuard)
export class UsuariosController {
  constructor(private readonly usuariosService: UsuariosService) {}

  @Get()
  @RequierePermiso('USUARIO_MANAGE')
  getUsuarios(@Request() req: RequestConUsuario) {
    return this.usuariosService.getUsuarios(req.user.id);
  }

  @Get('roles')
  @RequierePermiso('USUARIO_MANAGE')
  getRoles(@Request() req: RequestConUsuario) {
    return this.usuariosService.getRoles(req.user.id);
  }

  @Post('invitar')
  @RequierePermiso('USUARIO_MANAGE')
  invitarUsuario(
    @Request() req: RequestConUsuario,
    @Body('email') email: string,
    @Body('rol_id') rolId: string,
  ) {
    return this.usuariosService.invitarUsuario(req.user.id, email, rolId);
  }

  @Patch(':id/estado')
  @RequierePermiso('USUARIO_MANAGE')
  updateEstado(
    @Request() req: RequestConUsuario,
    @Param('id') usuarioId: string,
    @Body('estado') estado: boolean,
  ) {
    return this.usuariosService.updateEstado(req.user.id, usuarioId, estado);
  }
  @Delete(':id')
  @RequierePermiso('USUARIO_MANAGE')
  eliminarUsuario(
    @Request() req: RequestConUsuario,
    @Param('id') usuarioId: string,
  ) {
    return this.usuariosService.eliminarUsuario(req.user.id, usuarioId);
  }

  @Patch(':id/rol')
  @RequierePermiso('USUARIO_MANAGE')
  updateRol(
    @Request() req: RequestConUsuario,
    @Param('id') usuarioId: string,
    @Body('rol_id') rolId: string,
  ) {
    return this.usuariosService.updateRol(req.user.id, usuarioId, rolId);
  }
}
