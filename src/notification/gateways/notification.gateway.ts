import { Logger } from '@nestjs/common';
import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  WsResponse,
} from '@nestjs/websockets';
import { from, map, Observable } from 'rxjs';

import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  cors: true,
})
export class NotificationGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(NotificationGateway.name);

  @WebSocketServer()
  server!: Server;

  private onlineUsers = new Map<string, string>();

  // Runs when a client connects
  async handleConnection(client: Socket) {
    try {
      const userId = client.handshake.auth.userId;

      if (!userId) {
        client.disconnect();
        return;
      }

      this.onlineUsers.set(userId, client.id);

      client.join(`user:${userId}`);
    } catch (error) {
      this.logger.error('Connection error:', error);
      client.disconnect();
    }
  }

  // Runs when a client disconnects
  async handleDisconnect(client: Socket) {
    for (const [userId, socketId] of this.onlineUsers.entries()) {
      if (socketId === client.id) {
        this.onlineUsers.delete(userId);
      }
    }
  }

  // Utility: check if user is online
  isUserOnline(userId: string) {
    return this.onlineUsers.has(userId);
  }

  // Utility: send notification to a specific user
  sendToUser(userId: string, payload: any) {
    this.server.to(`user:${userId}`).emit('notification', payload);
  }

  // Below just for check................. remove in production
  // Runs once when gateway is initialized
  async afterInit(server: Server) {
    this.logger.log('NotificationGateway initialized: ' + server);
  }

  // Example of handling a custom event from client
  @SubscribeMessage('sendMessage')
  async handleSendMessage(
    client: Socket,
    payload: { to: string; message: string },
  ) {
    // Forward message to target user’s room
    this.server.to(`user:${payload.to}`).emit('message', {
      from: client.handshake.auth.userId,
      text: payload.message,
    });
  }

  // Another example: broadcast typing indicator
  @SubscribeMessage('typing')
  async handleTyping(client: Socket, payload: { to: string }) {
    this.server.to(`user:${payload.to}`).emit('typing', {
      from: client.handshake.auth.userId,
    });
  }

  @SubscribeMessage('events')
  onEvent(@MessageBody() data: unknown): Observable<WsResponse<number>> {
    const event = 'events'; // 👈 event name to emit back
    const response = [1, 2, 3]; // 👈 sample data to stream

    this.logger.log('Received event with data: ' + JSON.stringify(data));
    // 👇 Convert array into Observable and map each item into WsResponse
    return from(response).pipe(map((item) => ({ event, data: item })));
  }
}
