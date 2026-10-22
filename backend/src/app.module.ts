import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { JWT_SECRET } from './secreto';
import { DbService } from './db.service';
import { AuthGuard } from './auth/auth.guard';
import { AuthController } from './auth/auth.controller';
import { CatalogoController } from './catalogo.controller';
import { CitasController } from './citas.controller';
import { CitasService } from './citas.service';
import { OtrosController } from './otros.controller';
import { RecordatoriosService } from './recordatorios.service';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    // Límite general de peticiones por IP; el inicio de sesión tiene uno más estricto
    ThrottlerModule.forRoot({
      throttlers: [{ name: 'default', ttl: 60_000, limit: 120 }],
      errorMessage: 'Demasiados intentos. Espera un minuto y vuelve a intentar.',
    }),
    JwtModule.register({
      global: true,
      secret: JWT_SECRET,
      signOptions: { expiresIn: '30m' }, // RNF02
    }),
  ],
  controllers: [AuthController, CatalogoController, CitasController, OtrosController],
  providers: [DbService, CitasService, RecordatoriosService, { provide: APP_GUARD, useClass: ThrottlerGuard }, { provide: APP_GUARD, useClass: AuthGuard }],
})
export class AppModule {}
