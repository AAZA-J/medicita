import 'dotenv/config';
process.env.TZ = process.env.TZ || 'America/Guayaquil';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function main() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.setGlobalPrefix('api');
  app.use(helmet()); // Encabezados de seguridad
  app.set('trust proxy', 1); // Para leer la IP real detrás de nginx (límite de intentos)
  // Solo la dirección del frontend puede llamar a la API desde el navegador
  const origenes = (process.env.CORS_ORIGIN || process.env.FRONTEND_URL || 'http://localhost:5173')
    .split(',').map((s) => s.trim());
  app.enableCors({ origin: origenes, exposedHeaders: ['X-Token-Renovado'] });
  const port = Number(process.env.PORT || 3000);
  await app.listen(port);
  console.log(`API de MediCita lista en http://localhost:${port}/api`);
}
main();
