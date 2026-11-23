import { Controller, Get, Post, Body, Param, Delete, Request, Req, UseGuards, Query, Res, BadRequestException } from '@nestjs/common';
import { ContadoresService } from './contadores.service';
import type { QueryFacturasContador } from './contadores.service';
import type { RequestConUsuario } from '../common/tipos';
import { ExportContadorService, type ExportFilters } from './export-contador.service';
import { ImportacionService } from './importacion.service';
import { EliminacionService } from './eliminacion.service';
import { parseMultipart } from '../common/multipart.util';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermisosGuard } from '../common/permisos/permisos.guard';
import { RequierePermiso } from '../common/permisos/requiere-permiso.decorator';
import type { FastifyReply, FastifyRequest } from 'fastify';

@UseGuards(JwtAuthGuard, PermisosGuard)
@Controller('contadores')
export class ContadoresController {
  constructor(private readonly contadoresService: ContadoresService) {}

  @Post('invitar')
  @RequierePermiso('CONTADOR_INVITE')
  invitarContador(
    @Request() req: RequestConUsuario,
    @Body('email') email: string,
  ) {
    return this.contadoresService.invitarContador(req.user.id, email);
  }

  @Get()
  @RequierePermiso('CONTADOR_INVITE')
  getContadores(@Request() req: RequestConUsuario) {
    return this.contadoresService.getContadores(req.user.id);
  }

  @Delete(':id')
  @RequierePermiso('CONTADOR_INVITE')
  desvincularContador(@Request() req: RequestConUsuario, @Param('id') contadorId: string) {
    return this.contadoresService.desvincularContador(req.user.id, contadorId);
  }

  @Post('invitaciones/:invitacionId/aceptar')
  aceptarInvitacion(@Request() req: RequestConUsuario, @Param('invitacionId') invitacionId: string) {
    return this.contadoresService.aceptarInvitacion(req.user.id, req.user.tipo_usuario, invitacionId);
  }

  @Post('invitaciones/:invitacionId/rechazar')
  rechazarInvitacion(@Request() req: RequestConUsuario, @Param('invitacionId') invitacionId: string) {
    return this.contadoresService.rechazarInvitacion(req.user.id, req.user.tipo_usuario, invitacionId);
  }
}

@UseGuards(JwtAuthGuard)
@Controller('contador')
export class ContadorEmpresaController {
  constructor(
    private readonly contadoresService: ContadoresService,
    private readonly exportService: ExportContadorService,
    private readonly importacionService: ImportacionService,
    private readonly eliminacionService: EliminacionService,
  ) {}

  @Get('empresas')
  getMisEmpresas(@Request() req: RequestConUsuario, @Query() consulta: {busqueda?: string; pagina?: string}) {
    return this.contadoresService.getMisEmpresas(req.user.id, req.user.tipo_usuario, consulta);
  }

  @Get('empresas/:empresaId')
  getDetalleEmpresa(@Request() req: RequestConUsuario, @Param('empresaId') empresaId: string) {
    return this.contadoresService.getDetalleEmpresa(req.user.id, req.user.tipo_usuario, empresaId);
  }

  // Importar el Registro de Compras SUNAT (CSV) → crea las facturas de la empresa.
  @Post('empresas/:empresaId/importar')
  async importar(
    @Request() req: RequestConUsuario,
    @Req() fastifyReq: FastifyRequest,
    @Param('empresaId') empresaId: string,
  ) {
    const { file, fields } = await parseMultipart(fastifyReq);
    if (!file) {
      throw new BadRequestException('Debes adjuntar el archivo del registro de compras');
    }
    return this.importacionService.importar(req.user.id, req.user.tipo_usuario, empresaId, file, fields.revisar === 'true');
  }

  // Importaciones recientes de la empresa (para deshacerlas).
  @Get('empresas/:empresaId/importaciones')
  getImportaciones(
    @Request() req: RequestConUsuario,
    @Param('empresaId') empresaId: string,
  ) {
    return this.eliminacionService.getImportaciones(req.user.id, req.user.tipo_usuario, empresaId);
  }

  // Deshacer una importación: borra las facturas del lote (conserva las que tengan trabajo).
  @Delete('empresas/:empresaId/importaciones/:loteId')
  deshacerImportacion(
    @Request() req: RequestConUsuario,
    @Param('empresaId') empresaId: string,
    @Param('loteId') loteId: string,
  ) {
    return this.eliminacionService.deshacerLote(req.user.id, req.user.tipo_usuario, empresaId, loteId);
  }

  // Eliminar varias facturas seleccionadas.
  @Delete('empresas/:empresaId/facturas')
  eliminarFacturas(
    @Request() req: RequestConUsuario,
    @Param('empresaId') empresaId: string,
    @Body('ids') ids: string[],
  ) {
    if (!Array.isArray(ids)) {
      throw new BadRequestException('Debes indicar las facturas a eliminar');
    }
    return this.eliminacionService.eliminarFacturas(req.user.id, req.user.tipo_usuario, empresaId, ids);
  }

  // Eliminar una factura suelta (409 si tiene documentos/pagos).
  @Delete('empresas/:empresaId/facturas/:facturaId')
  eliminarFactura(
    @Request() req: RequestConUsuario,
    @Param('empresaId') empresaId: string,
    @Param('facturaId') facturaId: string,
  ) {
    return this.eliminacionService.eliminarFactura(req.user.id, req.user.tipo_usuario, empresaId, facturaId);
  }

  @Get('empresas/:empresaId/facturas')
  getFacturasDeEmpresa(
    @Request() req: RequestConUsuario,
    @Param('empresaId') empresaId: string,
    @Query() query: QueryFacturasContador,
  ) {
    return this.contadoresService.getFacturasDeEmpresa(req.user.id, req.user.tipo_usuario, empresaId, query);
  }

  @Get('empresas/:empresaId/facturas/:facturaId')
  getFacturaDetalle(
    @Request() req: RequestConUsuario,
    @Param('empresaId') empresaId: string,
    @Param('facturaId') facturaId: string,
  ) {
    return this.contadoresService.getFacturaDetalle(req.user.id, req.user.tipo_usuario, empresaId, facturaId);
  }

  @Post('empresas/:empresaId/facturas/:facturaId/observaciones')
  crearObservacion(
    @Request() req: RequestConUsuario,
    @Param('empresaId') empresaId: string,
    @Param('facturaId') facturaId: string,
    @Body() body: { contenido: string },
  ) {
    if (!body || typeof body.contenido !== 'string' || body.contenido.trim() === '') {
      throw new BadRequestException('El contenido de la observación es requerido');
    }
    return this.contadoresService.crearObservacionExterna(req.user.id, req.user.tipo_usuario, empresaId, facturaId, body.contenido.trim());
  }

  @Get('empresas/:empresaId/facturas/:facturaId/documentos/:documentoId/download')
  getDownloadUrl(
    @Request() req: RequestConUsuario,
    @Param('empresaId') empresaId: string,
    @Param('facturaId') facturaId: string,
    @Param('documentoId') documentoId: string,
  ) {
    return this.contadoresService.getDownloadUrlContador(req.user.id, req.user.tipo_usuario, empresaId, facturaId, documentoId);
  }

  @Get('empresas/:empresaId/exportar/excel')
  async exportarExcel(
    @Request() req: RequestConUsuario,
    @Param('empresaId') empresaId: string,
    @Query() query: ExportFilters,
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    const file = await this.exportService.generarExcel(
      req.user.id,
      req.user.tipo_usuario,
      empresaId,
      query,
    );
    res.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.header('Content-Disposition', `attachment; filename="facturas_${Date.now()}.xlsx"`);
    return file;
  }

  @Get('empresas/:empresaId/exportar/zip')
  async exportarZip(
    @Request() req: RequestConUsuario,
    @Param('empresaId') empresaId: string,
    @Query() query: ExportFilters,
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    const file = await this.exportService.generarZip(
      req.user.id,
      req.user.tipo_usuario,
      empresaId,
      query,
    );
    res.header('Content-Type', 'application/zip');
    res.header('Content-Disposition', `attachment; filename="export_${Date.now()}.zip"`);
    return file;
  }
}
