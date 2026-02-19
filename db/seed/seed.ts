import { PrismaClient, Rol } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { v4 as uuid } from 'uuid';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding MERO database...');

  // ─── Áreas ───
  const areas = await Promise.all([
    prisma.meroArea.upsert({ where: { id: 1 }, update: {}, create: { nombre: 'Laboratorio - Test Inicial', descripcion: 'Pruebas iniciales y desensamble' } }),
    prisma.meroArea.upsert({ where: { id: 2 }, update: {}, create: { nombre: 'Laboratorio - Reparación', descripcion: 'Reparación de equipos por nivel' } }),
    prisma.meroArea.upsert({ where: { id: 3 }, update: {}, create: { nombre: 'Lavado', descripcion: 'Lavado de componentes' } }),
    prisma.meroArea.upsert({ where: { id: 4 }, update: {}, create: { nombre: 'Laboratorio - Retest', descripcion: 'Verificación post-reparación' } }),
    prisma.meroArea.upsert({ where: { id: 5 }, update: {}, create: { nombre: 'Empaque', descripcion: 'Ensamble, etiquetado y empaquetado final' } }),
    prisma.meroArea.upsert({ where: { id: 6 }, update: {}, create: { nombre: 'Cosmética', descripcion: 'Lijado y liberación de componentes' } }),
    prisma.meroArea.upsert({ where: { id: 7 }, update: {}, create: { nombre: 'Pintura', descripcion: 'Pintura de componentes' } }),
    prisma.meroArea.upsert({ where: { id: 8 }, update: {}, create: { nombre: 'Serigrafía', descripcion: 'Serigrafía de componentes' } }),
  ]);

  const [labTest, labRep, lavado, labRetest, empaque, cosmetica, pintura, serigrafia] = areas;

  // ─── Subtareas ───
  const subtareasData = [
    // Laboratorio - Test Inicial
    { areaId: labTest.id, nombre: 'Test Visual' },
    { areaId: labTest.id, nombre: 'Test Funcional' },
    { areaId: labTest.id, nombre: 'Test Inicial' },
    { areaId: labTest.id, nombre: 'Desensamble de Tapa' },
    { areaId: labTest.id, nombre: 'Desolde' },
    { areaId: labTest.id, nombre: 'Desensamble de Tarjeta' },
    { areaId: labTest.id, nombre: 'Desensamble de Antena' },
    // Laboratorio - Reparación
    { areaId: labRep.id, nombre: 'Reparación N1' },
    { areaId: labRep.id, nombre: 'Reparación N2' },
    { areaId: labRep.id, nombre: 'Reparación N3' },
    { areaId: labRep.id, nombre: 'Retest-Reparación' },
    { areaId: labRep.id, nombre: 'Desguace' },
    { areaId: labRep.id, nombre: 'Reparación Antena' },
    // Lavado
    { areaId: lavado.id, nombre: 'Lavado Tapa' },
    { areaId: lavado.id, nombre: 'Lavado Base' },
    // Laboratorio - Retest
    { areaId: labRetest.id, nombre: 'Limpieza de Tarjeta' },
    { areaId: labRetest.id, nombre: 'Preensamble' },
    { areaId: labRetest.id, nombre: 'Retest' },
    // Empaque
    { areaId: empaque.id, nombre: 'Ensamble' },
    { areaId: empaque.id, nombre: 'Impresión Etiqueta' },
    { areaId: empaque.id, nombre: 'Etiquetado' },
    { areaId: empaque.id, nombre: 'Empaquetado' },
    // Cosmética
    { areaId: cosmetica.id, nombre: 'Lijado Tapa' },
    { areaId: cosmetica.id, nombre: 'Lijado Base' },
    { areaId: cosmetica.id, nombre: 'Lijado Capuchón' },
    { areaId: cosmetica.id, nombre: 'Liberación Tapa' },
    { areaId: cosmetica.id, nombre: 'Liberación Base' },
    { areaId: cosmetica.id, nombre: 'Liberación Capuchón' },
    // Pintura
    { areaId: pintura.id, nombre: 'Base' },
    { areaId: pintura.id, nombre: 'Tapa' },
    { areaId: pintura.id, nombre: 'Capuchón' },
    // Serigrafía
    { areaId: serigrafia.id, nombre: 'Base' },
    { areaId: serigrafia.id, nombre: 'Tapa' },
  ];

  let subtareaId = 1;
  for (const st of subtareasData) {
    await prisma.meroSubtarea.upsert({
      where: { id: subtareaId },
      update: {},
      create: st,
    });
    subtareaId++;
  }

  // ─── Modelos / SKU ───
  const modelosData = [
    'V5',
    'Extender Huawei',
    'Soundbox',
    '4K M36 Blanco',
    'Fiberhome',
    'ZTE',
    'Extender AP',
    'V5 Small',
    '4K Alexa',
    'Fiberhome Extender',
    'X6',
    'AP EH7',
    '4K M36 Azul',
  ];

  let modeloId = 1;
  for (const nombre of modelosData) {
    await prisma.meroModelo.upsert({
      where: { id: modeloId },
      update: {},
      create: { nombreSku: nombre },
    });
    modeloId++;
  }

  // ─── Empleados de ejemplo ───
  for (let i = 1; i <= 5; i++) {
    await prisma.meroEmpleado.upsert({
      where: { idVita: i },
      update: {},
      create: {
        idVita: i,
        uuidQr: uuid(),
        nombre: `Nombre Demo ${i}`,
        apellidos: `Apellido Demo ${i}`,
      },
    });
  }

  // ─── Usuario admin ───
  const passwordHash = await bcrypt.hash('admin1234', 10);
  await prisma.meroUsuario.upsert({
    where: { email: 'admin@mero.local' },
    update: {},
    create: {
      email: 'admin@mero.local',
      passwordHash,
      rol: Rol.ADMIN,
    },
  });

  console.log('Seed completado.');
  console.log('  - 8 áreas');
  console.log('  - 33 subtareas');
  console.log('  - 13 modelos/SKU');
  console.log('  - 5 empleados demo');
  console.log('  - 1 usuario admin (admin@mero.local / admin1234)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
