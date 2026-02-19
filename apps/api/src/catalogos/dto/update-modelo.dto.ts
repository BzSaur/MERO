import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdateModeloDto {
  @IsOptional()
  @IsString()
  nombreSku?: string;

  @IsOptional()
  @IsString()
  descripcion?: string;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
