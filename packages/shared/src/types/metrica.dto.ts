export interface MetricaHoraDto {
  asignacionId: number;
  slotHora: number;
  cantidad: number;
  estandar: number;
  eficienciaPct: number;
}

export interface MetricaDiaDto {
  fecha: string;
  areaId: number;
  subtareaId: number;
  modeloId: number;
  totalPiezas: number;
  promedioEficiencia: number;
  empleadosCount: number;
}
