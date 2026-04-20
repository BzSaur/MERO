import { IsBoolean, IsInt, IsOptional, IsString } from 'class-validator';

export class UpdateSubtareaDto {
  @IsOptional()
  @IsString()
  nombre?: string;

  @IsOptional()
  @IsString()
  descripcion?: string;

  @IsOptional()
  @IsInt()
  areaId?: number;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
