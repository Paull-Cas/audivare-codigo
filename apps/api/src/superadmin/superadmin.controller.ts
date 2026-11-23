import { Controller, Get, Post, Patch, Delete, Param, Body, Request, UseGuards } from '@nestjs/common';
import { SuperadminService } from './superadmin.service';
import { SuscripcionesService } from './suscripciones.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SuperadminGuard } from '../auth/superadmin.guard';
import { SuperadminPermisoGuard } from './superadmin-permiso.guard';
import { RequierePermisoSA } from './requiere-permiso-sa.decorator';
import type { RequestConUsuario } from '../common/tipos';

@Controller('superadmin')
@UseGuards(JwtAuthGuard, SuperadminGuard, SuperadminPermisoGuard)
export class SuperadminController {
  constructor(
    private readonly superadminService: SuperadminService,
    private readonly suscripcionesService: SuscripcionesService,
  ) {}

  // Lectura abierta a cualquier superadmin (dashboard y lista de empresas)
  @Get('empresas')
  getEmpresas() {
    return this.superadminService.getEmpresas();
  }

  @Get('mis-permisos')
  getMisPermisos(@Request() req: RequestConUsuario) {
    return this.superadminService.getMisPermisos(req.user.id);
  }

  @Patch('empresas/:id/estado')
  @RequierePermisoSA('SA_EMPRESA_MANAGE')
  updateEstadoEmpresa(@Param('id') id: string, @Body('estado_suscripcion') estado_suscripcion: 'ACTIVO' | 'SUSPENDIDO') {
    return this.superadminService.updateEstadoEmpresa(id, estado_suscripcion);
  }

  @Patch('empresas/:id/limite-usuarios')
  @RequierePermisoSA('SA_EMPRESA_MANAGE')
  updateLimiteUsuarios(@Param('id') id: string, @Body('limite_usuarios') limite_usuarios: number) {
    return this.superadminService.updateLimiteUsuarios(id, Number(limite_usuarios));
  }

  @Delete('empresas/:id')
  @RequierePermisoSA('SA_EMPRESA_MANAGE')
  eliminarEmpresa(@Param('id') id: string) {
    return this.superadminService.eliminarEmpresa(id);
  }

  // ---- Contadores externos ----

  // Lectura abierta a cualquier superadmin (como la lista de empresas).
  @Get('contadores')
  getContadores() {
    return this.superadminService.getContadores();
  }

  @Delete('contadores/:id')
  @RequierePermisoSA('SA_EMPRESA_MANAGE')
  eliminarContador(@Param('id') id: string) {
    return this.superadminService.eliminarContador(id);
  }

  // ---- Pagos del servicio (suscripción de cada empresa) ----

  @Get('empresas/:id/pagos')
  getPagosEmpresa(@Param('id') id: string) {
    return this.suscripcionesService.getPagos(id);
  }

  @Post('empresas/:id/pagos')
  @RequierePermisoSA('SA_EMPRESA_MANAGE')
  registrarPagoEmpresa(
    @Request() req: RequestConUsuario,
    @Param('id') id: string,
    @Body() body: { monto?: number | string; fecha_pago?: string; duracion_meses?: number | string },
  ) {
    return this.suscripcionesService.registrarPago(
      req.user.id,
      id,
      body.monto,
      body.fecha_pago,
      body.duracion_meses,
    );
  }

  // ---- Gestión de administradores de plataforma ----

  @Get('permisos-disponibles')
  @RequierePermisoSA('SA_SUPERADMIN_MANAGE')
  getPermisosDisponibles() {
    return this.superadminService.getPermisosDisponibles();
  }

  @Get('admins')
  @RequierePermisoSA('SA_SUPERADMIN_MANAGE')
  getAdmins() {
    return this.superadminService.getAdmins();
  }

  @Post('admins')
  @RequierePermisoSA('SA_SUPERADMIN_MANAGE')
  crearAdmin(@Body() body: { email: string; permisos?: string[] }) {
    return this.superadminService.crearAdmin(body.email, body.permisos ?? []);
  }

  @Patch('admins/:id/permisos')
  @RequierePermisoSA('SA_SUPERADMIN_MANAGE')
  updatePermisosAdmin(@Param('id') id: string, @Body() body: { permisos?: string[] }) {
    return this.superadminService.updatePermisosAdmin(id, body.permisos ?? []);
  }

  @Delete('admins/:id')
  @RequierePermisoSA('SA_SUPERADMIN_MANAGE')
  eliminarAdmin(@Request() req: RequestConUsuario, @Param('id') id: string) {
    return this.superadminService.eliminarAdmin(req.user.id, id);
  }
}
