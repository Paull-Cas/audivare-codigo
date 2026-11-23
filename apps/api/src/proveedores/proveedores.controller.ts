import { Controller, Get, Param, Query, Request, UseGuards } from '@nestjs/common';
import { ProveedoresService } from './proveedores.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermisosGuard } from '../common/permisos/permisos.guard';
import { RequierePermiso } from '../common/permisos/requiere-permiso.decorator';

@UseGuards(JwtAuthGuard, PermisosGuard)
@RequierePermiso('FACTURA_READ')
@Controller('proveedores')
export class ProveedoresController {
  constructor(private readonly proveedoresService: ProveedoresService) {}

  @Get()
  getProveedores(
    @Request() req: { user: { id: string } },
    @Query('buscar') buscar?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 10;
    return this.proveedoresService.getProveedores(req.user.id, buscar, pageNum, limitNum);
  }

  @Get(':identificador')
  getProveedorDetalle(
    @Request() req: { user: { id: string } },
    @Param('identificador') identificador: string,
  ) {
    return this.proveedoresService.getProveedorDetalle(req.user.id, identificador);
  }
}
