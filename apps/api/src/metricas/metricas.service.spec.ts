import { MetricasService } from './metricas.service';
import { PrismaService } from '../prisma/prisma.service';
import { EstandaresService } from '../catalogos/estandares.service';
import { VitaSyncService } from '../empleados/vita-sync.service';

describe('MetricasService.getMetricasDia (T1 — métricas por cantidad neta)', () => {
  let service: MetricasService;
  let prisma: { meroAsignacion: { findMany: jest.Mock } };
  let estandares: { findVigente: jest.Mock };
  let vitaSync: { getVitaEmpleadoDetalle: jest.Mock };

  beforeEach(() => {
    prisma = { meroAsignacion: { findMany: jest.fn() } };
    estandares = { findVigente: jest.fn().mockResolvedValue({ piezasPorHora: 50 }) };
    vitaSync = { getVitaEmpleadoDetalle: jest.fn().mockResolvedValue(null) };

    service = new MetricasService(
      prisma as unknown as PrismaService,
      estandares as unknown as EstandaresService,
      vitaSync as unknown as VitaSyncService,
    );
  });

  const baseAsig = {
    id: 1,
    tipo: 'DIRECTA',
    fecha: new Date('2026-05-15'),
    subtareaId: 1,
    modeloId: 1,
    empleado: { id: 10, nombre: 'Ana', apellidos: 'Pérez', idVita: 100 },
    area: { nombre: 'Área 1' },
    subtarea: { nombre: 'Subt 1' },
    modelo: { nombreSku: 'V5' },
  };

  it('totalPiezas suma cantidadNeta (no bruta): captura de 100 con 10 rechazos = 90', async () => {
    prisma.meroAsignacion.findMany.mockResolvedValue([
      {
        ...baseAsig,
        capturas: [
          {
            slotHora: 8,
            cantidad: 100,
            rechazos: [{ cantidad: 10 }],
          },
        ],
      },
    ]);

    const result = await service.getMetricasDia('2026-05-15');
    expect(result).toHaveLength(1);
    expect(result[0].totalPiezas).toBe(90);
  });

  it('edge case: captura con rechazos = 100% deja totalPiezas en 0', async () => {
    prisma.meroAsignacion.findMany.mockResolvedValue([
      {
        ...baseAsig,
        capturas: [
          {
            slotHora: 8,
            cantidad: 100,
            rechazos: [{ cantidad: 100 }],
          },
        ],
      },
    ]);

    const result = await service.getMetricasDia('2026-05-15');
    expect(result[0].totalPiezas).toBe(0);
  });

  it('múltiples slots: suma de netos por grupo área/subtarea/modelo', async () => {
    prisma.meroAsignacion.findMany.mockResolvedValue([
      {
        ...baseAsig,
        capturas: [
          { slotHora: 8, cantidad: 50, rechazos: [{ cantidad: 5 }] },
          { slotHora: 9, cantidad: 60, rechazos: [] },
        ],
      },
    ]);

    const result = await service.getMetricasDia('2026-05-15');
    // 45 + 60 = 105
    expect(result[0].totalPiezas).toBe(105);
  });
});
