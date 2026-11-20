import { Injectable } from '@nestjs/common';

import { WebsocketService } from '../services/websocket.service';

@Injectable()
export class WebsocketStrategy {
  constructor(private readonly websocketService: WebsocketService) {}

  async deliver(userId: string, payload: any) {
    await this.websocketService.send(userId, payload);
  }
}
