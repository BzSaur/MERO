/**
 * seed_usuarios.ts — Usuarios del sistema MERO
 *
 * Ejecutar:
 *   cd apps/api
 *   DATABASE_URL="postgresql://..." npx ts-node ../../db/seed/seed_usuarios.ts
 *
 * Contraseña inicial de todos: Mero#2024
 * (pedir a cada usuario que la cambie en su primer ingreso)
 */
import { PrismaClient, Rol } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const PASS_DEFECTO = 'Mero#2024';

interface UsuarioSeed {
  nombre: string;
  email: string;
  rol: Rol;
  areaId?: number;
}

// ── IDs de área (coinciden con el seed principal) ──
// 1 = Lab Test Inicial  2 = Lab Reparación  3 = Lavado
// 4 = Lab Retest        5 = Empaque         6 = Cosmética
// 7 = Pintura           8 = Serigrafía

const usuarios: UsuarioSeed[] = [
  // ── Administradores ──────────────────────────────────────────
  {
    nombre: 'Mario Martínez',
    email: 'mario.martinez@ramelectronics.com',
    rol: Rol.ADMIN,
  },
  {
    nombre: 'Fernando Alarcon',
    email: 'f.alarcon@ramelectronics.com.mx',
    rol: Rol.ADMIN,
  },

  // ── Encargados (uno por área principal) ─────────────────────
  {
    nombre: 'Encargado Test Inicial',
    email: 'testinicialram@gmail.com',
    rol: Rol.ENCARGADO,
    areaId: 1,
  },
  {
    nombre: 'Encargado Reparación',
    email: 'reparacionram@gmail.com',
    rol: Rol.ENCARGADO,
    areaId: 2,
  },
  {
    nombre: 'Encargado Lavado',
    email: 'lavado@ramelectronics.com.mx',
    rol: Rol.ENCARGADO,
    areaId: 3,
  },
  {
    nombre: 'Encargado Retest',
    email: 'retestram@gmail.com',
    rol: Rol.ENCARGADO,
    areaId: 4,
  },
  {
    nombre: 'Encargado Empaque',
    email: 'empaqueram@gmail.com',
    rol: Rol.ENCARGADO,
    areaId: 5,
  },
  {
    nombre: 'Encargado Cosmética',
    email: 'cosmeticaram2@gmail.com',
    rol: Rol.ENCARGADO,
    areaId: 6,
  },
  {
    nombre: 'Encargado Pintura',
    email: 'pintura@ramelectronics.com.mx',
    rol: Rol.ENCARGADO,
    areaId: 7,
  },
  {
    nombre: 'Encargado Serigrafía',
    email: 'serigrafia@ramelectronics.com.mx',
    rol: Rol.ENCARGADO,
    areaId: 8,
  },

  // ── Consultores ──────────────────────────────────────────────
  {
    nombre: 'Rodrigo Ojeda',
    email: 'rodrigo.ojeda@ramelectronics.com',
    rol: Rol.CONSULTOR,
  },
  {
    nombre: 'Abraham Correa',
    email: 'acorrea_nextgen@outlook.com',
    rol: Rol.CONSULTOR,
  },
  {
    nombre: 'Amairani Cruz',
    email: 'cruzarelyuwur@gmail.com',
    rol: Rol.CONSULTOR,
  },
];

async function main() {
  const hash = await bcrypt.hash(PASS_DEFECTO, 10);

  let creados = 0;
  let omitidos = 0;

  for (const u of usuarios) {
    const existe = await prisma.meroUsuario.findUnique({ where: { email: u.email } });

    if (existe) {
      console.log(`  omitido  ${u.email} (ya existe)`);
      omitidos++;
      continue;
    }

    await prisma.meroUsuario.create({
      data: {
        nombre:       u.nombre,
        email:        u.email,
        passwordHash: hash,
        rol:          u.rol,
        areaId:       u.areaId ?? null,
      },
    });
    console.log(`  creado   ${u.nombre} <${u.email}> [${u.rol}]`);
    creados++;
  }

  console.log(`\nSeed usuarios: ${creados} creados, ${omitidos} omitidos.`);
  console.log(`Contraseña inicial: ${PASS_DEFECTO}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => await prisma.$disconnect());
