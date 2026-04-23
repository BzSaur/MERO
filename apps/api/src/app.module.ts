import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { LoggerModule } from 'nestjs-pino';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsuariosModule } from './usuarios/usuarios.module';
import { CatalogosModule } from './catalogos/catalogos.module';
import { EmpleadosModule } from './empleados/empleados.module';
import { AsignacionesModule } from './asignaciones/asignaciones.module';
import { CapturasModule } from './capturas/capturas.module';
import { MetricasModule } from './metricas/metricas.module';
import { AuditoriaModule } from './auditoria/auditoria.module';
import { RechazosModule } from './rechazos/rechazos.module';
import { LimpiezaModule } from './limpieza/limpieza.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // El .env está en la raíz del monorepo; NestJS corre desde apps/api
      envFilePath: ['../../.env', '.env'],
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.NODE_ENV !== 'production' ? 'warn' : 'info',
        transport:
          process.env.NODE_ENV !== 'production'
            ? { target: 'pino-pretty', options: { colorize: true } }
            : undefined,
      },
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
    AuthModule,
    UsuariosModule,
    CatalogosModule,
    EmpleadosModule,
    AsignacionesModule,
    CapturasModule,
    MetricasModule,
    AuditoriaModule,
    RechazosModule,
    LimpiezaModule,
  ],
})
export class AppModule {}
