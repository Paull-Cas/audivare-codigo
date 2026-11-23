import { Controller, Get, Patch, Param, Request, UseGuards, Query } from '@nestjs/common';
import { NotificacionesService } from './notificaciones.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { RequestConUsuario } from '../common/tipos';

@UseGuards(JwtAuthGuard)
@Controller('notificaciones')
export class NotificacionesController {
  constructor(private readonly notificacionesService: NotificacionesService) {}

  @Get()
  getNotificaciones(@Request() req: RequestConUsuario, @Query('leida') leida?: string) {
    return this.notificacionesService.getNotificaciones(req.user.id, leida);
  }

  @Patch('leer-todas')
  marcarTodasLeidas(@Request() req: RequestConUsuario) {
    return this.notificacionesService.marcarTodasLeidas(req.user.id);
  }

  @Patch(':id/leer')
  marcarLeida(@Request() req: RequestConUsuario, @Param('id') id: string) {
    return this.notificacionesService.marcarLeida(req.user.id, id);
  }
}
