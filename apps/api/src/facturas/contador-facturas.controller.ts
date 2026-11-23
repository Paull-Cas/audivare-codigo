import { Controller, Get, Post, Patch, Delete, Param, Body, Request, Req, UseGuards, ForbiddenException, BadRequestException } from '@nestjs/common';
import { FacturasService } from './facturas.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { parseMultipart } from '../common/multipart.util';
import type { RequestConUsuario } from '../common/tipos';
import type { FastifyRequest } from 'fastify';

/**
 * Escritura de documentación y pagos por el CONTADOR externo, en paridad con la
 * empresa (a veces la empresa le envía los comprobantes por WhatsApp y él los
 * carga). Autorización por vínculo activo (la resuelve `FacturasService`); no usa
 * PermisosGuard porque el contador no tiene permisos de empresa. Vive en
 * FacturasModule para reutilizar `FacturasService` sin dependencia circular.
 */
@UseGuards(JwtAuthGuard)
@Controller('contador')
export class ContadorFacturasController {
  constructor(private readonly facturasService: FacturasService) {}

  private soloContador(req: RequestConUsuario) {
    if (req.user.tipo_usuario !== 'CONTADOR_EXTERNO') {
      throw new ForbiddenException('Solo el contador externo puede acceder a esta ruta');
    }
  }

  @Post('empresas/:empresaId/facturas')
  crear(@Request() req: RequestConUsuario, @Param('empresaId') empresaId: string, @Body() body: unknown) {
    this.soloContador(req);
    return this.facturasService.guardarFactura({ kind: 'CONTADOR', userId: req.user.id, empresaId }, body);
  }

  @Patch('empresas/:empresaId/facturas/:facturaId')
  editar(@Request() req: RequestConUsuario, @Param('empresaId') empresaId: string,
    @Param('facturaId') facturaId: string, @Body() body: unknown) {
    this.soloContador(req);
    return this.facturasService.guardarFactura({ kind: 'CONTADOR', userId: req.user.id, empresaId }, body, facturaId);
  }

  @Post('empresas/:empresaId/facturas/:facturaId/documentos')
  async uploadDocumento(
    @Request() req: RequestConUsuario,
    @Req() fastifyReq: FastifyRequest,
    @Param('empresaId') empresaId: string,
    @Param('facturaId') facturaId: string,
  ) {
    this.soloContador(req);
    const { fields, file } = await parseMultipart(fastifyReq);
    if (!file) {
      throw new BadRequestException('No se subió ningún archivo');
    }
    const tipoDocumento = fields.tipo_documento;
    if (!tipoDocumento) {
      throw new BadRequestException('tipo_documento es requerido');
    }
    return this.facturasService.uploadDocumento(
      { kind: 'CONTADOR', userId: req.user.id, empresaId },
      facturaId,
      file,
      tipoDocumento,
      fields.descripcion,
    );
  }

  @Patch('empresas/:empresaId/facturas/:facturaId/documentos/:documentoId')
  async replaceDocumento(
    @Request() req: RequestConUsuario,
    @Req() fastifyReq: FastifyRequest,
    @Param('empresaId') empresaId: string,
    @Param('facturaId') facturaId: string,
    @Param('documentoId') documentoId: string,
  ) {
    this.soloContador(req);
    const { file } = await parseMultipart(fastifyReq);
    if (!file) {
      throw new BadRequestException('No se subió ningún archivo');
    }
    return this.facturasService.replaceDocumento(
      { kind: 'CONTADOR', userId: req.user.id, empresaId },
      facturaId,
      documentoId,
      file,
    );
  }

  @Delete('empresas/:empresaId/facturas/:facturaId/documentos/:documentoId')
  deleteDocumento(
    @Request() req: RequestConUsuario,
    @Param('empresaId') empresaId: string,
    @Param('facturaId') facturaId: string,
    @Param('documentoId') documentoId: string,
  ) {
    this.soloContador(req);
    return this.facturasService.deleteDocumento(
      { kind: 'CONTADOR', userId: req.user.id, empresaId },
      facturaId,
      documentoId,
    );
  }

  @Patch('empresas/:empresaId/facturas/:facturaId/documentacion')
  marcarDocumentacion(
    @Request() req: RequestConUsuario,
    @Param('empresaId') empresaId: string,
    @Param('facturaId') facturaId: string,
    @Body() body: { completa: boolean },
  ) {
    this.soloContador(req);
    if (!body || typeof body.completa !== 'boolean') {
      throw new BadRequestException('El campo "completa" (booleano) es requerido');
    }
    return this.facturasService.marcarDocumentacion(
      { kind: 'CONTADOR', userId: req.user.id, empresaId },
      facturaId,
      body.completa,
    );
  }

  @Get('empresas/:empresaId/facturas/:facturaId/pagos/:pagoId/comprobante/descargar')
  getPagoComprobante(
    @Request() req: RequestConUsuario,
    @Param('empresaId') empresaId: string,
    @Param('facturaId') facturaId: string,
    @Param('pagoId') pagoId: string,
  ) {
    this.soloContador(req);
    return this.facturasService.getPagoComprobanteUrl(
      { kind: 'CONTADOR', userId: req.user.id, empresaId },
      facturaId,
      pagoId,
    );
  }

  @Post('empresas/:empresaId/facturas/:facturaId/pagos')
  async registrarPago(
    @Request() req: RequestConUsuario,
    @Req() fastifyReq: FastifyRequest,
    @Param('empresaId') empresaId: string,
    @Param('facturaId') facturaId: string,
  ) {
    this.soloContador(req);
    const { fields, file } = await parseMultipart(fastifyReq);
    const montoPagado = parseFloat(fields.monto_pagado ?? '');
    if (isNaN(montoPagado) || montoPagado <= 0) {
      throw new BadRequestException('monto_pagado debe ser mayor a 0');
    }
    if (!file || !file.filename) {
      throw new BadRequestException('El comprobante de pago es obligatorio');
    }
    return this.facturasService.registrarPago(
      { kind: 'CONTADOR', userId: req.user.id, empresaId },
      facturaId,
      { montoPagado, nota: fields.nota, tipoPago: fields.tipo_pago, file },
    );
  }

  @Patch('empresas/:empresaId/facturas/:facturaId/pagos/:pagoId')
  async actualizarPago(
    @Request() req: RequestConUsuario,
    @Req() fastifyReq: FastifyRequest,
    @Param('empresaId') empresaId: string,
    @Param('facturaId') facturaId: string,
    @Param('pagoId') pagoId: string,
  ) {
    this.soloContador(req);
    const { fields, file } = await parseMultipart(fastifyReq);
    const montoPagado = parseFloat(fields.monto_pagado ?? '');
    if (isNaN(montoPagado) || montoPagado <= 0) {
      throw new BadRequestException('monto_pagado debe ser mayor a 0');
    }
    return this.facturasService.actualizarPago(
      { kind: 'CONTADOR', userId: req.user.id, empresaId },
      facturaId,
      pagoId,
      { montoPagado, nota: fields.nota, tipoPago: fields.tipo_pago, file },
    );
  }

  @Delete('empresas/:empresaId/facturas/:facturaId/pagos/:pagoId')
  deletePago(
    @Request() req: RequestConUsuario,
    @Param('empresaId') empresaId: string,
    @Param('facturaId') facturaId: string,
    @Param('pagoId') pagoId: string,
  ) {
    this.soloContador(req);
    return this.facturasService.deletePago(
      { kind: 'CONTADOR', userId: req.user.id, empresaId },
      facturaId,
      pagoId,
    );
  }
}
