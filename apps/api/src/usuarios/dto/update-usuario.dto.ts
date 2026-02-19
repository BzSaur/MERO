import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsInt,
  MinLength,
} from 'class-validator';
import { Role } from '@mero/shared';

export class UpdateUsuarioDto {
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @MinLength(8)
  password?: string;

  @IsOptional()
  @IsEnum(Role)
  rol?: Role;

  @IsOptional()
  @IsInt()
  areaId?: number | null;
}
