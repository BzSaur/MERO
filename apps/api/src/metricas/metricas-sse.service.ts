import { Injectable } from '@nestjs/common';
import { Observable, Subject, map } from 'rxjs';

interface MetricaEvent {
  type: 'captura' | 'asignacion' | 'refresh';
  data: unknown;
}

@Injectable()
export class MetricasSseService {
  private readonly subject = new Subject<MetricaEvent>();

  /** Emite un evento a todos los clientes SSE conectados */
  emit(event: MetricaEvent) {
    this.subject.next(event);
  }

  /** Stream observable para el controller SSE */
  getStream(): Observable<MessageEvent> {
    return this.subject.asObservable().pipe(
      map(
        (event) =>
          ({
            data: JSON.stringify(event),
          }) as MessageEvent,
      ),
    );
  }
}
