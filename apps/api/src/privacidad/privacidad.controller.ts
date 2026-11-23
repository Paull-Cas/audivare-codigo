import { Controller, Get, Post, Patch, Body, Req, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { RequestConUsuario } from '../common/tipos';
import { PrivacidadService } from './privacidad.service';

@Controller('privacidad')
export class PrivacidadPublicaController {
  constructor(private readonly service: PrivacidadService) {}
  @Post('solicitudes') recibir(@Body() body: unknown) { return this.service.recibir(body); }
}
@Controller('superadmin/privacidad')
@UseGuards(JwtAuthGuard)
export class PrivacidadAdminController {
  constructor(private readonly service: PrivacidadService) {}
  @Get('solicitudes') listar(@Req() req: RequestConUsuario, @Query('antes') antes?: string) { return this.service.listar(req.user.id, antes); }
  @Post('incidentes') incidente(@Req() req: RequestConUsuario, @Body('descripcion') descripcion: unknown) { return this.service.incidente(req.user.id, descripcion); }
  @Get('solicitudes/:id') detalle(@Req() req: RequestConUsuario, @Param('id') id: string) { return this.service.detalle(req.user.id, id); }
  @Patch('solicitudes/:id') actualizar(@Req() req: RequestConUsuario, @Param('id') id: string, @Body() body: unknown) { return this.service.actualizar(req.user.id, id, body); }
  @Get('auditoria') auditoria(@Req() req: RequestConUsuario, @Query('antes') antes?: string) { return this.service.auditoria(req.user.id, antes); }
}
