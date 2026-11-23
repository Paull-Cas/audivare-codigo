import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Query,
  Param,
  Body,
  Req,
  Res,
  UseGuards,
  BadRequestException,
} from "@nestjs/common";
import type { FastifyReply } from "fastify";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import type { RequestConUsuario } from "../common/tipos";
import { parseMultipart } from "../common/multipart.util";
import { DocumentosMensualesService } from "./documentos-mensuales.service";
import { PdfMensualService } from "./pdf-mensual.service";

@Controller("documentos-mensuales")
@UseGuards(JwtAuthGuard)
export class DocumentosMensualesController {
  constructor(
    private readonly documentos: DocumentosMensualesService,
    private readonly pdf: PdfMensualService,
  ) {}
  @Get()
  listar(
    @Req() req: RequestConUsuario,
    @Query()
    q: {
      anio?: string;
      mes?: string;
      categoria?: string;
      pagina?: string;
      busqueda?: string;
      empresaId?: string;
    },
  ) {
    return this.documentos.listar(req.user, q, q.empresaId);
  }
  @Get("resumen")
  resumen(@Req() req: RequestConUsuario) {
    return this.documentos.resumen(req.user);
  }
  @Get("actividad")
  actividad(
    @Req() req: RequestConUsuario,
    @Query("empresaId") empresa?: string,
  ) {
    return this.documentos.actividad(req.user, empresa);
  }
  @Get("pdf")
  async exportar(
    @Req() req: RequestConUsuario,
    @Res() reply: FastifyReply,
    @Query()
    q: { anio?: string; mes?: string; categorias?: string; empresaId?: string },
  ) {
    const salida = await this.pdf.exportar(
      req.user,
      q.anio,
      q.mes,
      q.categorias,
      q.empresaId,
    );
    return reply
      .header("Cache-Control", "private, no-store")
      .header("Content-Disposition", `attachment; filename="${salida.nombre}"`)
      .type("application/pdf")
      .send(salida.bytes);
  }
  @Post()
  async subir(@Req() req: RequestConUsuario, @Query("empresaId") empresa?: string) {
    const { fields, file } = await parseMultipart(req);
    if (!file) throw new BadRequestException("Adjunta una foto o un PDF");
    return this.documentos.subir(req.user, file, fields, empresa);
  }
  @Patch(":id")
  async editar(
    @Req() req: RequestConUsuario,
    @Param("id") id: string,
    @Body() datos: { anio?: unknown; mes?: unknown; nota?: unknown },
    @Query("empresaId") empresa?: string,
  ) {
    if (req.isMultipart()) {
      const { fields, file } = await parseMultipart(req);
      return this.documentos.editar(req.user, id, fields, file ?? undefined, empresa);
    }
    if (!datos || typeof datos !== "object" || Array.isArray(datos))
      throw new BadRequestException("Datos inválidos");
    return this.documentos.editar(req.user, id, datos, undefined, empresa);
  }
  @Delete(":id")
  eliminar(@Req() req: RequestConUsuario, @Param("id") id: string) {
    return this.documentos.eliminar(req.user, id);
  }
  @Get(":id/descarga")
  async descargarOriginal(@Req() req: RequestConUsuario, @Param("id") id: string, @Query("empresaId") empresa: string | undefined, @Res() reply: FastifyReply) {
    const archivo = await this.documentos.descargarOriginal(req.user, id, empresa);
    const nombre = archivo.nombre.replace(/[\r\n\\/]/g, "_");
    const codificado = encodeURIComponent(nombre).replace(/['()*]/g, c => "%" + c.charCodeAt(0).toString(16).toUpperCase());
    return reply.header("Cache-Control", "private, no-store")
      .header("Content-Disposition", `attachment; filename="documento"; filename*=UTF-8''${codificado}`)
      .type(archivo.mime).send(archivo.bytes);
  }
  @Get(":id/archivo")
  descargar(
    @Req() req: RequestConUsuario,
    @Param("id") id: string,
    @Query("empresaId") empresa?: string,
  ) {
    return this.documentos.descargar(req.user, id, empresa);
  }
}
