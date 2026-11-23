import { Controller, Get, Post, Patch, Delete, Param, Query, Body, Request, Req, UseGuards, BadRequestException } from '@nestjs/common';
import { DocumentosEmpresaService } from './documentos-empresa.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermisosGuard } from '../common/permisos/permisos.guard';
import { RequierePermiso } from '../common/permisos/requiere-permiso.decorator';
import { parseMultipart } from '../common/multipart.util';
import type { RequestConUsuario } from '../common/tipos';
import type { FastifyRequest } from 'fastify';

/** Repositorio de documentos a nivel de empresa (préstamos, estados de cuenta, leasing, etc.). */
@UseGuards(JwtAuthGuard, PermisosGuard)
@Controller('documentos-empresa')
export class DocumentosEmpresaController {
  constructor(private readonly service: DocumentosEmpresaService) {}

  @Get()
  @RequierePermiso('DOCUMENTO_EMPRESA_MANAGE')
  listar(
    @Request() req: RequestConUsuario,
    @Query('anio') anio?: string,
    @Query('mes') mes?: string,
  ) {
    return this.service.listarEmpresa(req.user.id, anio, mes);
  }

  @Post()
  @RequierePermiso('DOCUMENTO_EMPRESA_MANAGE')
  async subir(@Request() req: RequestConUsuario, @Req() fastifyReq: FastifyRequest) {
    const { fields, file } = await parseMultipart(fastifyReq);
    if (!file) {
      throw new BadRequestException('Debes adjuntar un archivo');
    }
    return this.service.subir(req.user.id, file, {
      titulo: fields.titulo ?? '',
      descripcion: fields.descripcion,
      anio: fields.anio ? Number(fields.anio) : null,
      mes: fields.mes ? Number(fields.mes) : null,
    });
  }

  // Conversación con el contador (solicitudes/mensajes). Va antes de `:id` no es
  // necesario porque `mensajes` no colisiona con las rutas `:id/...`.
  @Get('mensajes')
  @RequierePermiso('DOCUMENTO_EMPRESA_MANAGE')
  getMensajes(@Request() req: RequestConUsuario) {
    return this.service.getMensajesEmpresa(req.user.id);
  }

  @Post('mensajes')
  @RequierePermiso('DOCUMENTO_EMPRESA_MANAGE')
  crearMensaje(@Request() req: RequestConUsuario, @Body() body: { contenido: string }) {
    return this.service.crearMensajeEmpresa(req.user.id, body?.contenido ?? '');
  }

  @Get(':id/descargar')
  @RequierePermiso('DOCUMENTO_EMPRESA_MANAGE')
  descargar(@Request() req: RequestConUsuario, @Param('id') id: string) {
    return this.service.getDownloadUrlEmpresa(req.user.id, id);
  }

  @Patch(':id')
  @RequierePermiso('DOCUMENTO_EMPRESA_MANAGE')
  actualizarDatos(
    @Request() req: RequestConUsuario,
    @Param('id') id: string,
    @Body() body: { titulo: string; descripcion?: string; anio?: number | null; mes?: number | null },
  ) {
    return this.service.actualizarDatos(req.user.id, id, {
      titulo: body?.titulo ?? '',
      descripcion: body?.descripcion,
      anio: body?.anio ?? null,
      mes: body?.mes ?? null,
    });
  }

  @Patch(':id/archivo')
  @RequierePermiso('DOCUMENTO_EMPRESA_MANAGE')
  async reemplazar(@Request() req: RequestConUsuario, @Req() fastifyReq: FastifyRequest, @Param('id') id: string) {
    const { file } = await parseMultipart(fastifyReq);
    if (!file) {
      throw new BadRequestException('Debes adjuntar un archivo');
    }
    return this.service.reemplazar(req.user.id, id, file);
  }

  @Delete(':id')
  @RequierePermiso('DOCUMENTO_EMPRESA_MANAGE')
  eliminar(@Request() req: RequestConUsuario, @Param('id') id: string) {
    return this.service.eliminar(req.user.id, id);
  }
}

/** Vista de solo lectura para el contador externo, sobre las empresas a las que está vinculado. */
@UseGuards(JwtAuthGuard)
@Controller('contador')
export class ContadorDocumentosEmpresaController {
  constructor(private readonly service: DocumentosEmpresaService) {}

  @Get('empresas/:empresaId/documentos-empresa')
  listar(
    @Request() req: RequestConUsuario,
    @Param('empresaId') empresaId: string,
    @Query('anio') anio?: string,
    @Query('mes') mes?: string,
  ) {
    return this.service.listarContador(req.user.id, req.user.tipo_usuario, empresaId, anio, mes);
  }

  @Get('empresas/:empresaId/documentos-empresa/mensajes')
  getMensajes(
    @Request() req: RequestConUsuario,
    @Param('empresaId') empresaId: string,
  ) {
    return this.service.getMensajesContador(req.user.id, req.user.tipo_usuario, empresaId);
  }

  @Post('empresas/:empresaId/documentos-empresa/mensajes')
  crearMensaje(
    @Request() req: RequestConUsuario,
    @Param('empresaId') empresaId: string,
    @Body() body: { contenido: string },
  ) {
    return this.service.crearMensajeContador(req.user.id, req.user.tipo_usuario, empresaId, body?.contenido ?? '');
  }

  @Get('empresas/:empresaId/documentos-empresa/:id/descargar')
  descargar(
    @Request() req: RequestConUsuario,
    @Param('empresaId') empresaId: string,
    @Param('id') id: string,
  ) {
    return this.service.getDownloadUrlContador(req.user.id, req.user.tipo_usuario, empresaId, id);
  }
}
