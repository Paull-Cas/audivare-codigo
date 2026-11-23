// Servidor de ensayo: controladores/guardas reales, almacenamiento ficticio.
// Quien lo importe debe configurar previamente una BD exclusiva de pruebas.
require('reflect-metadata');
const { Module } = require('@nestjs/common');
const { NestFactory } = require('@nestjs/core');
const { FastifyAdapter } = require('@nestjs/platform-fastify');
const { JwtService } = require('@nestjs/jwt');
const { FacturasService } = require('../../dist/facturas/facturas.service');
const { FacturasController } = require('../../dist/facturas/facturas.controller');
const { ContadorFacturasController } = require('../../dist/facturas/contador-facturas.controller');
const { ContadorEmpresaController } = require('../../dist/contadores/contadores.controller');
const { ContadoresService } = require('../../dist/contadores/contadores.service');
const { ImportacionService } = require('../../dist/contadores/importacion.service');
const { EliminacionService } = require('../../dist/contadores/eliminacion.service');
const { ExportContadorService } = require('../../dist/contadores/export-contador.service');
const { PermisosService } = require('../../dist/common/permisos/permisos.service');
const { NotificacionesService } = require('../../dist/notificaciones/notificaciones.service');
const { SesionesService } = require('../../dist/auth/sesiones.service');
const { JwtStrategy } = require('../../dist/auth/jwt.strategy');
const { JwtAuthGuard } = require('../../dist/auth/jwt-auth.guard');
const { PermisosGuard } = require('../../dist/common/permisos/permisos.guard');
const { PerfilController } = require('../../dist/usuarios/perfil.controller');
const { UsuariosService } = require('../../dist/usuarios/usuarios.service');

async function crearAppFacturas(storage = { async uploadFile() { return 'ficticio/documento.pdf'; }, async deleteFile() {} }) {
  const permisos = new PermisosService(), avisos = new NotificacionesService();
  const sesiones = new SesionesService(new JwtService({ secret: process.env.JWT_SECRET }), permisos);
  class Ensayo {}
  Module({ controllers: [FacturasController, ContadorFacturasController, ContadorEmpresaController, PerfilController],
    providers: [JwtAuthGuard, PermisosGuard,
      { provide: JwtStrategy, useValue: new JwtStrategy(sesiones) },
      { provide: PermisosService, useValue: permisos },
      { provide: FacturasService, useValue: new FacturasService(storage, permisos, avisos) },
      { provide: ContadoresService, useValue: new ContadoresService(permisos, storage, avisos) },
      { provide: ImportacionService, useValue: new ImportacionService(permisos, avisos) },
      { provide: EliminacionService, useValue: new EliminacionService(permisos, avisos) },
      { provide: ExportContadorService, useValue: {} },
      { provide: UsuariosService, useValue: {} },
    ] })(Ensayo);
  const app = await NestFactory.create(Ensayo, new FastifyAdapter(), { logger: false });
  await app.register(require('@fastify/multipart'), { limits: { fileSize: 10 * 1024 * 1024 } });
  await app.init();
  return { app, sesiones };
}
module.exports = { crearAppFacturas };
