import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { join } from 'node:path';
import { AppModule } from './app.module';

async function bootstrap() {
  // rawBody: true additionally exposes req.rawBody (a Buffer) on every request, alongside the normal
  // parsed req.body — needed to verify the WhatsApp webhook's X-Hub-Signature-256 HMAC, which must be
  // computed over the exact raw bytes Meta sent, not a re-serialized JSON object (see
  // WhatsAppController). Nest's own built-in option for this, doesn't change body handling anywhere
  // else.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true });
  const config = app.get(ConfigService);

  app.enableCors({ origin: true, credentials: true });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));

  // Local-disk upload stub (school logos, student photos) — see UploadsService for the swap-to-S3
  // note. Files are served unauthenticated, same as any static asset host would; no sensitive
  // documents (medical records, etc.) are ever stored here, only display images.
  app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/uploads/' });

  const swaggerConfig = new DocumentBuilder()
    .setTitle('School ERP API')
    .setDescription('Multi-tenant Kenyan CBC School Management ERP — see docs/API.md')
    .setVersion('0.1')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  // cPanel/Passenger assigns the listening port via process.env.PORT at runtime; API_PORT is the
  // local-dev fallback.
  const port = process.env.PORT ?? config.get<number>('API_PORT') ?? 4000;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`API listening on http://localhost:${port} (docs at /api/docs)`);
}

bootstrap();
