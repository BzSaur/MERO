import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdateSubtareaDto {
  @IsOptional()
  @IsString()
  nombre?: string;

  @IsOptional()
  @IsString()
  descripcion?: string;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
