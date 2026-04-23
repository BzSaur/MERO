import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { Request } from 'express';
import { AuditoriaService } from './auditoria.service';

// Rutas operativas de alto volumen que no aportan valor en auditoría
const RUTAS_EXCLUIDAS = [
  '/auth/',
  '/metricas/stream',
  '/capturas',
  '/asignaciones',
];

/**
 * Interceptor global que registra operaciones de escritura (POST, PATCH, PUT, DELETE).
 * Excluye rutas operativas de alto volumen (capturas, asignaciones) para no saturar auditoría.
 */
@Injectable()
export class AuditoriaInterceptor implements NestInterceptor {
  constructor(private readonly auditoria: AuditoriaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<Request>();
    const method = req.method;

    if (!['POST', 'PATCH', 'PUT', 'DELETE'].includes(method)) {
      return next.handle();
    }

    const url = req.url;
    if (RUTAS_EXCLUIDAS.some((ruta) => url.includes(ruta))) {
      return next.handle();
    }

    const user = req.user as { id: number } | undefined;
    const ip =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.socket.remoteAddress ||
      'unknown';

    return next.handle().pipe(
      tap((responseData) => {
        if (!user) return;

        // Extraer tabla del path (e.g., /api/catalogos/areas -> mero_areas)
        const pathParts = url.replace(/^\/api\//, '').split('/');
        const tabla =
          pathParts.length > 1
            ? `mero_${pathParts[1]}`
            : `mero_${pathParts[0]}`;

        const registroId =
          (responseData as Record<string, unknown>)?.id as number ?? 0;

        this.auditoria
          .log({
            usuarioId: user.id,
            accion: method,
            tabla,
            registroId,
            datosDespues: responseData,
            ip,
          })
          .catch(() => {
            // No bloquear la respuesta si falla la auditoría
          });
      }),
    );
  }
}
