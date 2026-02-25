/**
 * seed.ts — Datos iniciales de MERO
 *
 * Se ejecuta automáticamente al arrancar el contenedor
 * (después de las migraciones de Prisma).
 *
 * Es idempotente: usa upsert / omite registros ya existentes.
 *
 * Para correr manualmente dentro del contenedor:
 *   node dist/seed.js
 */
import { PrismaClient, Rol } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

// ─── Áreas ───────────────────────────────────────────────────────────────────

const AREAS = [
  { id: 1, nombre: 'Laboratorio - Test Inicial', descripcion: 'Pruebas iniciales y desensamble' },
  { id: 2, nombre: 'Laboratorio - Reparación',   descripcion: 'Reparación de equipos por nivel' },
  { id: 3, nombre: 'Lavado',                     descripcion: 'Lavado de componentes' },
  { id: 4, nombre: 'Laboratorio - Retest',       descripcion: 'Verificación post-reparación' },
  { id: 5, nombre: 'Empaque',                    descripcion: 'Ensamble, etiquetado y empaquetado final' },
  { id: 6, nombre: 'Cosmética',                  descripcion: 'Lijado y liberación de componentes' },
  { id: 7, nombre: 'Pintura',                    descripcion: 'Pintura de componentes' },
  { id: 8, nombre: 'Serigrafía',                 descripcion: 'Serigrafía de componentes' },
];

// ─── Subtareas ────────────────────────────────────────────────────────────────

const SUBTAREAS = [
  // Laboratorio - Test Inicial (areaId: 1)
  { id:  1, areaId: 1, nombre: 'Test Visual' },
  { id:  2, areaId: 1, nombre: 'Test Funcional' },
  { id:  3, areaId: 1, nombre: 'Test Inicial' },
  { id:  4, areaId: 1, nombre: 'Desensamble de Tapa' },
  { id:  5, areaId: 1, nombre: 'Desolde' },
  { id:  6, areaId: 1, nombre: 'Desensamble de Tarjeta' },
  { id:  7, areaId: 1, nombre: 'Desensamble de Antena' },
  // Laboratorio - Reparación (areaId: 2)
  { id:  8, areaId: 2, nombre: 'Reparación N1' },
  { id:  9, areaId: 2, nombre: 'Reparación N2' },
  { id: 10, areaId: 2, nombre: 'Reparación N3' },
  { id: 11, areaId: 2, nombre: 'Retest-Reparación' },
  { id: 12, areaId: 2, nombre: 'Desguace' },
  { id: 13, areaId: 2, nombre: 'Reparación Antena' },
  // Lavado (areaId: 3)
  { id: 14, areaId: 3, nombre: 'Lavado Tapa' },
  { id: 15, areaId: 3, nombre: 'Lavado Base' },
  // Laboratorio - Retest (areaId: 4)
  { id: 16, areaId: 4, nombre: 'Limpieza de Tarjeta' },
  { id: 17, areaId: 4, nombre: 'Preensamble' },
  { id: 18, areaId: 4, nombre: 'Retest' },
  // Empaque (areaId: 5)
  { id: 19, areaId: 5, nombre: 'Ensamble' },
  { id: 20, areaId: 5, nombre: 'Impresión Etiqueta' },
  { id: 21, areaId: 5, nombre: 'Etiquetado' },
  { id: 22, areaId: 5, nombre: 'Empaquetado' },
  // Cosmética (areaId: 6)
  { id: 23, areaId: 6, nombre: 'Lijado Tapa' },
  { id: 24, areaId: 6, nombre: 'Lijado Base' },
  { id: 25, areaId: 6, nombre: 'Lijado Capuchón' },
  { id: 26, areaId: 6, nombre: 'Liberación Tapa' },
  { id: 27, areaId: 6, nombre: 'Liberación Base' },
  { id: 28, areaId: 6, nombre: 'Liberación Capuchón' },
  // Pintura (areaId: 7)
  { id: 29, areaId: 7, nombre: 'Base' },
  { id: 30, areaId: 7, nombre: 'Tapa' },
  { id: 31, areaId: 7, nombre: 'Capuchón' },
  // Serigrafía (areaId: 8)
  { id: 32, areaId: 8, nombre: 'Base' },
  { id: 33, areaId: 8, nombre: 'Tapa' },
];

// ─── Modelos / SKU ────────────────────────────────────────────────────────────

const MODELOS = [
  'V5', 'Extender Huawei', 'Soundbox', '4K M36 Blanco', 'Fiberhome',
  'ZTE', 'Extender AP', 'V5 Small', '4K Alexa', 'Fiberhome Extender',
  'X6', 'AP EH7', '4K M36 Azul',
];

// ─── Usuarios del sistema ─────────────────────────────────────────────────────

interface UsuarioSeed {
  nombre: string;
  email: string;
  rol: Rol;
  areaId?: number;
}

const USUARIOS: UsuarioSeed[] = [
  // Administradores
  { nombre: 'Administrador MERO',   email: 'admin@mero.local',                     rol: Rol.ADMIN },
  { nombre: 'Mario Martínez',       email: 'mario.martinez@ramelectronics.com',     rol: Rol.ADMIN },
  { nombre: 'Fernando Alarcon',     email: 'f.alarcon@ramelectronics.com.mx',       rol: Rol.ADMIN },
  // Encargados
  { nombre: 'Encargado Test Inicial', email: 'testinicialram@gmail.com',            rol: Rol.ENCARGADO, areaId: 1 },
  { nombre: 'Encargado Reparación',   email: 'reparacionram@gmail.com',             rol: Rol.ENCARGADO, areaId: 2 },
  { nombre: 'Encargado Lavado',       email: 'lavado@ramelectronics.com.mx',        rol: Rol.ENCARGADO, areaId: 3 },
  { nombre: 'Encargado Retest',       email: 'retestram@gmail.com',                 rol: Rol.ENCARGADO, areaId: 4 },
  { nombre: 'Encargado Empaque',      email: 'empaqueram@gmail.com',                rol: Rol.ENCARGADO, areaId: 5 },
  { nombre: 'Encargado Cosmética',    email: 'cosmeticaram2@gmail.com',             rol: Rol.ENCARGADO, areaId: 6 },
  { nombre: 'Encargado Pintura',      email: 'pintura@ramelectronics.com.mx',       rol: Rol.ENCARGADO, areaId: 7 },
  { nombre: 'Encargado Serigrafía',   email: 'serigrafia@ramelectronics.com.mx',    rol: Rol.ENCARGADO, areaId: 8 },
  // Consultores
  { nombre: 'Rodrigo Ojeda',   email: 'rodrigo.ojeda@ramelectronics.com', rol: Rol.CONSULTOR },
  { nombre: 'Abraham Correa',  email: 'acorrea_nextgen@outlook.com',       rol: Rol.CONSULTOR },
  { nombre: 'Amairani Cruz',   email: 'cruzarelyuwur@gmail.com',           rol: Rol.CONSULTOR },
];

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('>> Seeding MERO database...');

  // Áreas: secuencial para garantizar IDs correctos
  for (const area of AREAS) {
    await prisma.meroArea.upsert({
      where:  { id: area.id },
      update: {},
      create: area,
    });
  }
  console.log(`   ${AREAS.length} áreas`);

  // Subtareas
  for (const st of SUBTAREAS) {
    await prisma.meroSubtarea.upsert({
      where:  { id: st.id },
      update: {},
      create: st,
    });
  }
  console.log(`   ${SUBTAREAS.length} subtareas`);

  // Modelos / SKU
  for (let i = 0; i < MODELOS.length; i++) {
    await prisma.meroModelo.upsert({
      where:  { id: i + 1 },
      update: {},
      create: { nombreSku: MODELOS[i] },
    });
  }
  console.log(`   ${MODELOS.length} modelos`);

  // Empleados se sincronizan desde VITA — no se crean demos
  const totalEmpleados = await prisma.meroEmpleado.count();
  console.log(`   ${totalEmpleados} empleados (sync desde VITA)`);

  // Usuarios (contraseña inicial: Mero#2024, excepto admin@mero.local → admin1234)
  const adminHash = await bcrypt.hash('admin1234', 10);
  const userHash  = await bcrypt.hash('Mero#2024', 10);

  let creados = 0;
  for (const u of USUARIOS) {
    const existe = await prisma.meroUsuario.findUnique({ where: { email: u.email } });
    if (existe) continue;

    const hash = u.email === 'admin@mero.local' ? adminHash : userHash;
    await prisma.meroUsuario.create({
      data: {
        nombre:       u.nombre,
        email:        u.email,
        passwordHash: hash,
        rol:          u.rol,
        areaId:       u.areaId ?? null,
      },
    });
    creados++;
  }
  console.log(`   ${creados} usuarios (${USUARIOS.length - creados} ya existían)`);

  console.log('>> Seed completado.');
  console.log('   Login inicial: admin@mero.local / admin1234');
  console.log('   Resto de usuarios: Mero#2024');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => await prisma.$disconnect());
