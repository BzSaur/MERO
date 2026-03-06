import { Module } from '@nestjs/common';
import { EmpleadosController } from './empleados.controller';
import { EmpleadosService } from './empleados.service';
import { VitaSyncService } from './vita-sync.service';

@Module({
  controllers: [EmpleadosController],
  providers: [EmpleadosService, VitaSyncService],
  // 👇 exporta VitaSyncService para que MetricasModule lo pueda usar
  exports: [EmpleadosService, VitaSyncService],
})
export class EmpleadosModule {}