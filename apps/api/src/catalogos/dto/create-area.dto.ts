import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateAreaDto {
  @IsString()
  @IsNotEmpty()
  nombre: string;

  @IsOptional()
  @IsString()
  descripcion?: string;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
