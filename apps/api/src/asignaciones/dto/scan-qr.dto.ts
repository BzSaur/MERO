import { IsInt, IsUUID } from 'class-validator';

export class ScanQrDto {
  @IsUUID()
  uuidQr: string;

  @IsInt()
  areaId: number;

  @IsInt()
  subtareaId: number;

  @IsInt()
  modeloId: number;
}