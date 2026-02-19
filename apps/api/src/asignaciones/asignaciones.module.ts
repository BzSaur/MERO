import { Module } from '@nestjs/common';
import { AsignacionesController } from './asignaciones.controller';
import { AsignacionesService } from './asignaciones.service';
import { EmpleadosModule } from '../empleados/empleados.module';

@Module({
  imports: [EmpleadosModule],
  controllers: [AsignacionesController],
  providers: [AsignacionesService],
  exports: [AsignacionesService],
})
export class AsignacionesModule {}
