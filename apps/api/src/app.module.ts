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

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    LoggerModule.forRoot({
      pinoHttp: {
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
  ],
})
export class AppModule {}
