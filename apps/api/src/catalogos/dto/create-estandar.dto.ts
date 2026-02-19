import { IsDateString, IsInt, IsNumber, Min } from 'class-validator';

export class CreateEstandarDto {
  @IsInt()
  subtareaId: number;

  @IsInt()
  modeloId: number;

  @IsNumber()
  @Min(0)
  piezasPorHora: number;

  @IsDateString()
  vigenteDesde: string;
}
