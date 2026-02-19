import { IsInt, IsNotEmpty, IsString } from 'class-validator';

export class ScanQrDto {
  @IsString()
  @IsNotEmpty()
  uuidQr: string;

  @IsInt()
  areaId: number;

  @IsInt()
  subtareaId: number;

  @IsInt()
  modeloId: number;
}
