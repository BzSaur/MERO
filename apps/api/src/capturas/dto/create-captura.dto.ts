import { IsInt, Min } from 'class-validator';

export class CreateCapturaDto {
  @IsInt()
  asignacionId: number;

  @IsInt()
  @Min(0)
  slotHora: number;

  @IsInt()
  @Min(0)
  cantidad: number;
}
