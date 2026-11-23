import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from './app.module';
import { getPort, getCorsOrigin } from './common/config';

import fastifyMultipart from '@fastify/multipart';
import { LIMITES_MULTIPART } from './common/multipart.util';
import { registrarSeguridadHttp } from './common/seguridad-http';
import { registrarAuditoriaHttp } from './privacidad/auditoria-http';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ bodyLimit: 128 * 1024, requestTimeout: 60000, connectionTimeout: 10000, trustProxy: false })
  );
  registrarSeguridadHttp(app.getHttpAdapter().getInstance(), evento => console.log(evento));
  registrarAuditoriaHttp(app.getHttpAdapter().getInstance(), () => console.error('AUDITORIA_NO_COMPLETADA'));
  app.enableCors({ origin: getCorsOrigin(), credentials: true });

  await app.register(fastifyMultipart, {
    limits: LIMITES_MULTIPART,
  });
  await app.listen(getPort(), '0.0.0.0');
  console.log(`Application is running on: ${await app.getUrl()}`);
}
bootstrap();
