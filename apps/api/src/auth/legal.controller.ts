import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { db } from '@audivare/database';
import { JwtAuthGuard } from './jwt-auth.guard';
import type { RequestConUsuario } from '../common/tipos';
import { estadoAceptacionLegal, registrarAceptacionLegal, validarAceptacionLegal } from './aceptacion-legal';

@Controller('legal')
@UseGuards(JwtAuthGuard)
export class LegalController {
  @Get('aceptacion')
  estado(@Req() req: RequestConUsuario) { return estadoAceptacionLegal(req.user.id); }

  @Post('aceptacion')
  async aceptar(@Req() req: RequestConUsuario, @Body() body: unknown) {
    validarAceptacionLegal(body);
    // Revisión personal: nunca atribuir representación de empresa a esta acción.
    return db.transaction(tx => registrarAceptacionLegal(tx, req.user.id, null, 'REVISION'));
  }
}
