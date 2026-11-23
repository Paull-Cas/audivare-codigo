import { Controller, Get, Patch, Body, Request, UseGuards } from '@nestjs/common';
import { UsuariosService } from './usuarios.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { RequestConUsuario } from '../common/tipos';
import { PermisosService } from '../common/permisos/permisos.service';

@UseGuards(JwtAuthGuard)
@Controller('perfil')
export class PerfilController {
  constructor(
    private readonly usuariosService: UsuariosService,
    private readonly permisosService: PermisosService,
  ) {}

  @Get()
  async getPerfil(@Request() req: RequestConUsuario) {
    return this.usuariosService.getPerfil(req.user.id);
  }

  @Get('permisos')
  async getPermisos(@Request() req: RequestConUsuario) {
    return { permisos: await this.permisosService.getPermisos(req.user.id) };
  }

  @Patch()
  async updatePerfil(
    @Request() req: RequestConUsuario,
    @Body() body: { nombre_completo?: string; avatar_url?: string }
  ) {
    return this.usuariosService.updatePerfil(req.user.id, body);
  }

}
