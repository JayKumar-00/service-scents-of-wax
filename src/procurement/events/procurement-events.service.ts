import { Injectable } from '@nestjs/common';

@Injectable()
export class ProcurementEventsService {
  emit(eventName: string, payload: Record<string, any>) {
    return { eventName, payload };
  }
}
