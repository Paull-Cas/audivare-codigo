import { Controller, Get, Param, Query, Request, UseGuards } from '@nestjs/common';
import { PagosService } from './pagos.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermisosGuard } from '../common/permisos/permisos.guard';
import { RequierePermiso } from '../common/permisos/requiere-permiso.decorator';

@UseGuards(JwtAuthGuard, PermisosGuard)
@RequierePermiso('PAGO_READ')
@Controller('pagos')
export class PagosController {
  constructor(private readonly pagosService: PagosService) {}

  @Get()
  getPagos(
    @Request() req: { user: { id: string } },
    @Query('anio') anio?: string,
    @Query('mes') mes?: string,
    @Query('proveedor') proveedor?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 10;

    return this.pagosService.getPagos(
      req.user.id,
      anio,
      mes,
      proveedor,
      pageNum,
      limitNum
    );
  }

  @Get(':id/comprobante')
  async getComprobanteDownloadUrl(
    @Request() req: { user: { id: string } },
    @Param('id') id: string
  ) {
    return this.pagosService.getComprobanteDownloadUrl(req.user.id, id);
  }
}
