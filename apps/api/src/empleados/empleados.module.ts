import { Module } from '@nestjs/common';
import { EmpleadosController } from './empleados.controller';
import { EmpleadosService } from './empleados.service';
import { VitaSyncService } from './vita-sync.service';
import { MailService } from './mail.service';

@Module({
  controllers: [EmpleadosController],
  providers: [EmpleadosService, VitaSyncService, MailService],
  exports: [EmpleadosService, VitaSyncService],
})
export class EmpleadosModule {}
