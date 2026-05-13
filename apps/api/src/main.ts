import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  const httpAdapter = app.getHttpAdapter().getInstance();
  httpAdapter.disable('x-powered-by');
  httpAdapter.use((_req: any, res: any, next: any) => {
    res.removeHeader('x-powered-by');
    next();
  });

  app.useLogger(app.get(Logger));

  const config = app.get(ConfigService);
  const port = config.get<number>('API_PORT', 3000);
  const prefix = config.get<string>('API_PREFIX', '/api');
  const corsOriginRaw = config.get<string>('CORS_ORIGIN', 'http://localhost:5173');
  const corsOrigin = corsOriginRaw.includes(',')
    ? corsOriginRaw.split(',').map((o) => o.trim())
    : corsOriginRaw;

  app.setGlobalPrefix(prefix);

  app.enableCors({
    origin: corsOrigin,
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  await app.listen(port);
}

bootstrap();