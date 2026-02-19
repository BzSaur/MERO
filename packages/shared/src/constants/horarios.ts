export interface SlotHorario {
  hora: number;
  label: string;
  esExtension: boolean;
}

/**
 * Horarios operativos de planta.
 *
 * L-V: 08:00–14:00 (matutino) + 15:00–18:00 (vespertino)
 *      Extensión opcional: 18:00–19:00
 *      14:00–15:00 es hora de comida (sin captura)
 *
 * S:   08:00–14:00 (matutino)
 *      Extensión opcional: 14:00–17:00
 */
export const HORARIOS = {
  TURNO_MATUTINO: { inicio: 8, fin: 14 },
  TURNO_VESPERTINO: { inicio: 15, fin: 18 },
  EXTENSION_LV: { inicio: 18, fin: 19 },
  EXTENSION_SABADO: { inicio: 14, fin: 17 },
  HORA_COMIDA: 14, // 14:00–15:00 L-V, sin captura

  /** Días laborales ISO: 1=Lunes ... 6=Sábado */
  DIAS_LABORALES: [1, 2, 3, 4, 5, 6] as const,
  DIA_SABADO: 6,

  /**
   * Genera los slots regulares para un día de la semana (1-7, ISO).
   * No incluye extensiones — usar getSlotsConExtension para eso.
   */
  getSlotsParaDia(diaSemana: number): SlotHorario[] {
    const slots: SlotHorario[] = [];
    const { TURNO_MATUTINO, TURNO_VESPERTINO, DIA_SABADO } = HORARIOS;

    // Turno matutino (L-S: 08–14)
    for (let h = TURNO_MATUTINO.inicio; h < TURNO_MATUTINO.fin; h++) {
      slots.push({ hora: h, label: `${h}:00 - ${h + 1}:00`, esExtension: false });
    }

    // Turno vespertino (solo L-V: 15–18)
    if (diaSemana !== DIA_SABADO) {
      for (let h = TURNO_VESPERTINO.inicio; h < TURNO_VESPERTINO.fin; h++) {
        slots.push({ hora: h, label: `${h}:00 - ${h + 1}:00`, esExtension: false });
      }
    }

    return slots;
  },

  /**
   * Genera todos los slots incluyendo extensiones opcionales.
   * L-V: regulares + 18:00–19:00
   * S:   regulares + 14:00–17:00
   */
  getSlotsConExtension(diaSemana: number): SlotHorario[] {
    const slots = HORARIOS.getSlotsParaDia(diaSemana);
    const { EXTENSION_LV, EXTENSION_SABADO, DIA_SABADO } = HORARIOS;

    if (diaSemana === DIA_SABADO) {
      for (let h = EXTENSION_SABADO.inicio; h < EXTENSION_SABADO.fin; h++) {
        slots.push({ hora: h, label: `${h}:00 - ${h + 1}:00`, esExtension: true });
      }
    } else {
      for (let h = EXTENSION_LV.inicio; h < EXTENSION_LV.fin; h++) {
        slots.push({ hora: h, label: `${h}:00 - ${h + 1}:00`, esExtension: true });
      }
    }

    return slots;
  },

  /** Verifica si una hora cae en periodo de comida (14:00–15:00 L-V) */
  esHoraComida(hora: number, diaSemana: number): boolean {
    return hora === 14 && diaSemana !== HORARIOS.DIA_SABADO;
  },
} as const;
