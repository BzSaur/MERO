export interface AsignacionDto {
  id: number;
  empleadoId: number;
  areaId: number;
  subtareaId: number;
  modeloId: number;
  fecha: string;
  horaInicio: string;
  horaFin: string | null;
  activa: boolean;
}
