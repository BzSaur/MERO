import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsInt,
  MinLength,
} from 'class-validator';
import { Role } from '@mero/shared';

export class CreateUsuarioDto {
  @IsNotEmpty()
  nombre: string;

  @IsEmail()
  email: string;

  @IsNotEmpty()
  @MinLength(8)
  password: string;

  @IsEnum(Role)
  rol: Role;

  @IsOptional()
  @IsInt()
  areaId?: number;
}
