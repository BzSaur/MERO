-- Agregar nombre con default temporal para el registro existente
ALTER TABLE "mero_usuarios" ADD COLUMN "nombre" VARCHAR(200) NOT NULL DEFAULT '';

-- Actualizar el admin existente
UPDATE "mero_usuarios" SET "nombre" = 'Administrador' WHERE "nombre" = '';

-- Quitar el default (el campo queda NOT NULL sin default, como el schema)
ALTER TABLE "mero_usuarios" ALTER COLUMN "nombre" DROP DEFAULT;
