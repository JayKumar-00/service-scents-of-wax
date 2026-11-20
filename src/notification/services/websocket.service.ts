import { Injectable } from '@nestjs/common';

import { NotificationGateway } from '../gateways/notification.gateway';

@Injectable()
export class WebsocketService {
  constructor(private readonly gateway: NotificationGateway) {}

  isOnline(userId: string) {
    return this.gateway.isUserOnline(userId);
  }

  async send(userId: string, payload: any) {
    this.gateway.sendToUser(userId, payload);
  }
}
