/**
 * seed-empleados-test.ts — Empleados ficticios para desarrollo local sin VITA.
 *
 * Inserta empleados con idVita en el rango 99001+ (no choca con VITA real).
 * Idempotente: usa upsert por idVita.
 *
 * Correr:  pnpm db:seed:empleados:test
 * Borrar:  ver función `clean()` al final (descomentar y correr).
 */
import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

interface EmpleadoTest {
  idVita: number;
  nombre: string;
  apellidos: string;
  idAreaVita: number;
}

const EMPLEADOS_TEST: EmpleadoTest[] = [
  { idVita: 99001, nombre: 'Test',  apellidos: 'Inicial Uno',     idAreaVita: 1 },
  { idVita: 99002, nombre: 'Test',  apellidos: 'Inicial Dos',     idAreaVita: 1 },
  { idVita: 99003, nombre: 'Repa',  apellidos: 'Nivel Uno',       idAreaVita: 2 },
  { idVita: 99004, nombre: 'Empa',  apellidos: 'Que Tres',        idAreaVita: 5 },
  { idVita: 99005, nombre: 'Cosme', apellidos: 'Tica Cuatro',     idAreaVita: 6 },
];

async function main() {
  console.log('>> Seeding empleados de prueba (sin VITA)...');

  for (const emp of EMPLEADOS_TEST) {
    const existente = await prisma.meroEmpleado.findUnique({
      where: { idVita: emp.idVita },
    });

    if (existente) {
      await prisma.meroEmpleado.update({
        where: { idVita: emp.idVita },
        data: {
          nombre: emp.nombre,
          apellidos: emp.apellidos,
          idAreaVita: emp.idAreaVita,
          activo: true,
        },
      });
      console.log(`   actualizado: ${emp.nombre} ${emp.apellidos} (idVita=${emp.idVita})`);
    } else {
      await prisma.meroEmpleado.create({
        data: {
          idVita: emp.idVita,
          uuidQr: uuidv4(),
          nombre: emp.nombre,
          apellidos: emp.apellidos,
          idAreaVita: emp.idAreaVita,
          activo: true,
        },
      });
      console.log(`   creado:     ${emp.nombre} ${emp.apellidos} (idVita=${emp.idVita})`);
    }
  }

  console.log(`>> Listo: ${EMPLEADOS_TEST.length} empleados de prueba en MERO.`);
}

// Para borrar los empleados de prueba, llamar a esta función manualmente:
// await clean();
async function clean() {
  const ids = EMPLEADOS_TEST.map((e) => e.idVita);
  const res = await prisma.meroEmpleado.deleteMany({
    where: { idVita: { in: ids } },
  });
  console.log(`>> Borrados ${res.count} empleados de prueba.`);
}
void clean;

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
