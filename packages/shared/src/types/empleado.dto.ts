export interface EmpleadoDto {
  id: number;
  idVita: number;
  uuidQr: string;
  nombre: string;
  apellidos: string | null;
  idAreaVita: number | null;
  activo: boolean;
}
