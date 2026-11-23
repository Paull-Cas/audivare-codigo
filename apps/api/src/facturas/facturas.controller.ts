import { Controller, Get, Post, Patch, Delete, Param, Query, Request, UseGuards, Req, Res, BadRequestException, Body } from '@nestjs/common';
import { FacturasService } from './facturas.service';
import { ExportContadorService, type ExportFilters } from '../contadores/export-contador.service';
import { PermisosService } from '../common/permisos/permisos.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermisosGuard } from '../common/permisos/permisos.guard';
import { RequierePermiso } from '../common/permisos/requiere-permiso.decorator';
import type { RequestConUsuario } from '../common/tipos';
import { parseMultipart } from '../common/multipart.util';
import type { FastifyRequest, FastifyReply } from 'fastify';

@Controller('facturas')
@UseGuards(JwtAuthGuard, PermisosGuard)
export class FacturasController {
  constructor(
    private readonly facturasService: FacturasService,
    private readonly exportService: ExportContadorService,
    private readonly permisosService: PermisosService,
  ) {}

  @Post()
  @RequierePermiso('FACTURA_CREATE')
  crear(@Request() req: RequestConUsuario, @Body() body: unknown) {
    return this.facturasService.guardarFactura({ kind: 'INTERNO', userId: req.user.id }, body);
  }

  @Patch(':id')
  @RequierePermiso('FACTURA_UPDATE')
  editar(@Request() req: RequestConUsuario, @Param('id') id: string, @Body() body: unknown) {
    return this.facturasService.guardarFactura({ kind: 'INTERNO', userId: req.user.id }, body, id);
  }

  @Get()
  @RequierePermiso('FACTURA_READ')
  async getFacturas(
    @Request() req: RequestConUsuario,
    @Query('estado') estado?: string,
    @Query('proveedor') proveedor?: string,
    @Query('anio') anio?: string,
    @Query('mes') mes?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('busqueda') busqueda?: string,
  ) {
    const userId = req.user.id;
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 10;

    return this.facturasService.findAll(
      userId,
      estado,
      proveedor,
      anio,
      mes,
      pageNum,
      limitNum,
      busqueda,
    );
  }

  // Exportación de la propia empresa (el contador tiene sus rutas en /contador).
  // Se declaran antes de `:id` para que no las capture la ruta con parámetro.
  @Get('exportar/excel')
  @RequierePermiso('FACTURA_EXPORT_EXCEL')
  async exportarExcel(
    @Request() req: RequestConUsuario,
    @Query() query: ExportFilters,
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    const empresaId = await this.permisosService.getEmpresaId(req.user.id);
    const file = await this.exportService.generarExcelEmpresa(empresaId, query);
    res.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.header('Content-Disposition', `attachment; filename="facturas_${Date.now()}.xlsx"`);
    return file;
  }

  @Get('exportar/zip')
  @RequierePermiso('FACTURA_EXPORT_ZIP')
  async exportarZip(
    @Request() req: RequestConUsuario,
    @Query() query: ExportFilters,
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    const empresaId = await this.permisosService.getEmpresaId(req.user.id);
    const file = await this.exportService.generarZipEmpresa(empresaId, query);
    res.header('Content-Type', 'application/zip');
    res.header('Content-Disposition', `attachment; filename="export_${Date.now()}.zip"`);
    return file;
  }

  @Get(':id')
  @RequierePermiso('FACTURA_READ')
  async getFactura(@Request() req: RequestConUsuario, @Param('id') id: string) {
    return this.facturasService.findOne(req.user.id, id);
  }

  @Post(':id/documentos')
  @RequierePermiso('DOCUMENTO_UPLOAD')
  async uploadDocumento(@Request() req: RequestConUsuario, @Req() fastifyReq: FastifyRequest, @Param('id') id: string) {
    const { fields, file } = await parseMultipart(fastifyReq);

    if (!file) {
      throw new BadRequestException('No se subió ningún archivo');
    }

    const tipoDocumento = fields.tipo_documento;
    const descripcion = fields.descripcion;

    if (!tipoDocumento) {
      throw new BadRequestException('tipo_documento es requerido');
    }

    return this.facturasService.uploadDocumento({ kind: 'INTERNO', userId: req.user.id }, id, file, tipoDocumento, descripcion);
  }

  @Get(':id/documentos/:documentoId/descargar')
  @RequierePermiso('FACTURA_READ')
  async getDocumentoDescarga(@Request() req: RequestConUsuario, @Param('id') id: string, @Param('documentoId') documentoId: string) {
    return this.facturasService.getDownloadUrl(req.user.id, id, documentoId);
  }

  @Patch(':id/documentos/:documentoId')
  @RequierePermiso('DOCUMENTO_UPLOAD')
  async replaceDocumento(
    @Request() req: RequestConUsuario,
    @Req() fastifyReq: FastifyRequest,
    @Param('id') id: string,
    @Param('documentoId') documentoId: string,
  ) {
    const { file } = await parseMultipart(fastifyReq);

    if (!file) {
      throw new BadRequestException('No se subió ningún archivo');
    }

    return this.facturasService.replaceDocumento({ kind: 'INTERNO', userId: req.user.id }, id, documentoId, file);
  }

  // La empresa marca la documentación de la factura como completa o pendiente.
  @Patch(':id/documentacion')
  @RequierePermiso('DOCUMENTO_UPLOAD')
  async marcarDocumentacion(
    @Request() req: RequestConUsuario,
    @Param('id') id: string,
    @Body() body: { completa: boolean },
  ) {
    if (!body || typeof body.completa !== 'boolean') {
      throw new BadRequestException('El campo "completa" (booleano) es requerido');
    }
    return this.facturasService.marcarDocumentacion({ kind: 'INTERNO', userId: req.user.id }, id, body.completa);
  }

  // Solicitudes del contador que la empresa puede ver y responder.
  @Get(':id/observaciones/externas')
  @RequierePermiso('OBSERVACION_READ')
  async getObservacionesExternas(@Request() req: RequestConUsuario, @Param('id') id: string) {
    return this.facturasService.getObservacionesExternas(req.user.id, id);
  }

  @Patch(':id/observaciones/:observacionId/atender')
  @RequierePermiso('OBSERVACION_WRITE')
  async atenderObservacion(
    @Request() req: RequestConUsuario,
    @Param('id') id: string,
    @Param('observacionId') observacionId: string,
    @Body() body?: { respuesta?: string }
  ) {
    return this.facturasService.atenderObservacion(req.user.id, id, observacionId, body?.respuesta);
  }

  @Get(':id/pagos')
  @RequierePermiso('PAGO_READ')
  async getPagos(@Request() req: RequestConUsuario, @Param('id') id: string) {
    return this.facturasService.getPagos(req.user.id, id);
  }

  @Get(':id/pagos/:pagoId/comprobante/descargar')
  @RequierePermiso('PAGO_READ')
  async getPagoComprobanteDescarga(
    @Request() req: RequestConUsuario,
    @Param('id') id: string,
    @Param('pagoId') pagoId: string,
  ) {
    return this.facturasService.getPagoComprobanteUrl({ kind: 'INTERNO', userId: req.user.id }, id, pagoId);
  }

  @Delete(':id/documentos/:documentoId')
  @RequierePermiso('DOCUMENTO_DELETE')
  async deleteDocumento(
    @Request() req: RequestConUsuario,
    @Param('id') id: string,
    @Param('documentoId') documentoId: string
  ) {
    return this.facturasService.deleteDocumento({ kind: 'INTERNO', userId: req.user.id }, id, documentoId);
  }

  @Post(':id/pagos')
  @RequierePermiso('PAGO_REGISTRAR')
  async registrarPago(@Request() req: RequestConUsuario, @Req() fastifyReq: FastifyRequest, @Param('id') id: string) {
    const { fields, file } = await parseMultipart(fastifyReq);

    const monto_pagado = parseFloat(fields.monto_pagado ?? '');
    const nota = fields.nota;

    if (isNaN(monto_pagado) || monto_pagado <= 0) {
      throw new BadRequestException('monto_pagado debe ser mayor a 0');
    }
    if (!file || !file.filename) {
      throw new BadRequestException('El comprobante de pago es obligatorio');
    }

    return this.facturasService.registrarPago({ kind: 'INTERNO', userId: req.user.id }, id, {
      montoPagado: monto_pagado,
      nota,
      tipoPago: fields.tipo_pago,
      file
    });
  }

  @Patch(':id/pagos/:pagoId')
  @RequierePermiso('PAGO_UPDATE')
  async actualizarPago(
    @Request() req: RequestConUsuario,
    @Req() fastifyReq: FastifyRequest,
    @Param('id') id: string,
    @Param('pagoId') pagoId: string
  ) {
    const { fields, file } = await parseMultipart(fastifyReq);

    const monto_pagado = parseFloat(fields.monto_pagado ?? '');
    const nota = fields.nota;

    if (isNaN(monto_pagado) || monto_pagado <= 0) {
      throw new BadRequestException('monto_pagado debe ser mayor a 0');
    }

    return this.facturasService.actualizarPago({ kind: 'INTERNO', userId: req.user.id }, id, pagoId, {
      montoPagado: monto_pagado,
      nota,
      tipoPago: fields.tipo_pago,
      file
    });
  }

  @Delete(':id/pagos/:pagoId')
  @RequierePermiso('PAGO_DELETE')
  async deletePago(
    @Request() req: RequestConUsuario,
    @Param('id') id: string,
    @Param('pagoId') pagoId: string
  ) {
    return this.facturasService.deletePago({ kind: 'INTERNO', userId: req.user.id }, id, pagoId);
  }
}
