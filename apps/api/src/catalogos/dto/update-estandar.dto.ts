import { IsDateString, IsNumber, IsOptional, Min } from 'class-validator';

export class UpdateEstandarDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  piezasPorHora?: number;

  @IsOptional()
  @IsDateString()
  vigenteDesde?: string;
}