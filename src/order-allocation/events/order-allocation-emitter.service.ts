import { Injectable } from '@nestjs/common';
import { EventEmitter } from 'events';
import {
  OrderAllocationEventName,
  OrderAllocationEventPayloadMap,
} from './order-allocation.events';

@Injectable()
export class OrderAllocationEmitterService {
  private readonly emitter = new EventEmitter();

  emit<T extends OrderAllocationEventName>(
    eventName: T,
    payload: OrderAllocationEventPayloadMap[T],
  ) {
    this.emitter.emit(eventName, payload);
  }

  on<T extends OrderAllocationEventName>(
    eventName: T,
    listener: (
      payload: OrderAllocationEventPayloadMap[T],
    ) => void | Promise<void>,
  ) {
    this.emitter.on(eventName, listener as any);
  }
}
