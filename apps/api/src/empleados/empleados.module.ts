import { Module } from '@nestjs/common';
import { EmpleadosController } from './empleados.controller';
import { EmpleadosService } from './empleados.service';
import { VitaSyncService } from './vita-sync.service';

@Module({
  controllers: [EmpleadosController],
  providers: [EmpleadosService, VitaSyncService],
  exports: [EmpleadosService],
})
export class EmpleadosModule {}
