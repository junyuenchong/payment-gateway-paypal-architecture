import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';
import { HttpExceptionFilter } from './shared/filters/http-exception.filter';
import configuration from './config/configuration';

async function bootstrap(): Promise<void> {
  const config = configuration();
  const app = await NestFactory.create(AppModule, { rawBody: true });

  app.enableCors({
    origin: config.app.corsOrigins,
    credentials: false,
  });
  app.useGlobalFilters(new HttpExceptionFilter());

  await app.listen(config.app.port);
  Logger.log(
    `🚀 ${config.app.projectName} is running on: http://localhost:${config.app.port}`,
  );
}
void bootstrap();
