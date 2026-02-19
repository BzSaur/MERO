import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateModeloDto {
  @IsString()
  @IsNotEmpty()
  nombreSku: string;

  @IsOptional()
  @IsString()
  descripcion?: string;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
