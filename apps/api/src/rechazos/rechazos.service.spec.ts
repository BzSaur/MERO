import { BadRequestException, NotFoundException } from '@nestjs/common';
import { RechazosService } from './rechazos.service';
import { PrismaService } from '../prisma/prisma.service';
import { MetricasSseService } from '../metricas/metricas-sse.service';

describe('RechazosService.create (T2 — validación por asignación)', () => {
  let service: RechazosService;
  let prisma: {
    meroCaptura: { findUnique: jest.Mock };
    meroRechazo: { create: jest.Mock };
  };
  let sse: { emit: jest.Mock };

  beforeEach(() => {
    prisma = {
      meroCaptura: { findUnique: jest.fn() },
      meroRechazo: { create: jest.fn().mockResolvedValue({ id: 999 }) },
    };
    sse = { emit: jest.fn() };

    service = new RechazosService(
      prisma as unknown as PrismaService,
      sse as unknown as MetricasSseService,
    );
  });

  /**
   * Asignación con capturas A=30 y B=50 (total 80).
   * Rechazar 60 vía captura A debe aceptar (antes fallaba porque
   * validaba solo contra los 30 de A).
   */
  function asigA30B50({
    rechazosA = [],
    rechazosB = [],
    targetId = 1,
  }: {
    rechazosA?: { cantidad: number }[];
    rechazosB?: { cantidad: number }[];
    targetId?: number;
  } = {}) {
    return {
      id: targetId,
      asignacionId: 7,
      slotHora: 8,
      cantidad: 30,
      asignacion: {
        id: 7,
        capturas: [
          { id: 1, cantidad: 30, rechazos: rechazosA },
          { id: 2, cantidad: 50, rechazos: rechazosB },
        ],
      },
    };
  }

  it('rechaza 60 vía captura A (capturas A=30 + B=50) → OK', async () => {
    prisma.meroCaptura.findUnique.mockResolvedValue(asigA30B50());

    await expect(
      service.create({ capturaId: 1, cantidad: 60 }, 1),
    ).resolves.toBeDefined();

    expect(prisma.meroRechazo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ capturaId: 1, cantidad: 60 }),
      }),
    );
  });

  it('rechaza 90 (capturas A=30 + B=50, total 80) → BadRequestException con mensaje exacto', async () => {
    prisma.meroCaptura.findUnique.mockResolvedValue(asigA30B50());

    await expect(
      service.create({ capturaId: 1, cantidad: 90 }, 1),
    ).rejects.toThrow(
      new BadRequestException(
        'Solo puedes rechazar 80 piezas (capturado: 80, ya rechazado: 0)',
      ),
    );
  });

  it('mensaje considera rechazos previos: A=30+B=50 con 20 ya rechazados → max 60', async () => {
    prisma.meroCaptura.findUnique.mockResolvedValue(
      asigA30B50({ rechazosA: [{ cantidad: 20 }] }),
    );

    await expect(
      service.create({ capturaId: 1, cantidad: 61 }, 1),
    ).rejects.toThrow(
      new BadRequestException(
        'Solo puedes rechazar 60 piezas (capturado: 80, ya rechazado: 20)',
      ),
    );
  });

  it('captura no encontrada → NotFoundException', async () => {
    prisma.meroCaptura.findUnique.mockResolvedValue(null);

    await expect(
      service.create({ capturaId: 999, cantidad: 1 }, 1),
    ).rejects.toThrow(NotFoundException);
  });

  it('emite SSE con totalNeto correcto después del rechazo', async () => {
    prisma.meroCaptura.findUnique.mockResolvedValue(asigA30B50());

    await service.create({ capturaId: 1, cantidad: 10 }, 1);

    expect(sse.emit).toHaveBeenCalledWith({
      type: 'captura',
      data: expect.objectContaining({
        asignacionId: 7,
        capturaId: 1,
        totalCapturado: 80,
        totalRechazado: 10,
        totalNeto: 70,
      }),
    });
  });
});
