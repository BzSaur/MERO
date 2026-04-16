# Tarea 4.3 - Revision de imagen dentro del QR

Fecha: 2026-04-16

## Estado actual
- Si existe codigo para insertar imagen/logo dentro del QR.
- Ubicacion principal: `apps/api/src/empleados/empleados.service.ts`.
- Funcion relevante: `buildQrBuffer(uuidQr)`.
- Librerias usadas:
  - `qrcode` para generar el QR base (`errorCorrectionLevel: 'H'`).
  - `sharp` para componer logo + padding blanco centrado sobre el QR.
- La funcionalidad esta activa porque `generateQrImage(id)` usa `buildQrBuffer`.

## Funciona o no
- Si, funciona con la implementacion actual (QR con logo centrado).
- El contenido codificado del QR sigue siendo `uuidQr` de `MeroEmpleado`.

## Causa raiz si falla
- No se detecta una falla funcional general en la logica.
- Riesgos operativos identificados:
  - Falta de archivo logo (`apps/api/assets/logo.png`) rompe la composicion.
  - Cambios agresivos en tamano del logo pueden afectar legibilidad en escaneo.

## Propuesta
- Mantener la implementacion actual para produccion (logo discreto + correccion H).
- No aumentar el area ocupada por logo por arriba del rango actual.
- En entorno de planta (iluminacion industrial), priorizar confiabilidad de escaneo sobre branding visual.

## Estimacion
- Corregir fallas puntuales (si aparecen): XS-S.
- Mejorar con variantes de logo/tamano configurables por ambiente: S-M.
- Descartar logo y usar QR limpio para maxima robustez: XS.
