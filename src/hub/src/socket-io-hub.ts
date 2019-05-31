import express = require('express');
import { Server } from 'http';
import io from 'socket.io';

import { log } from './log';

export class IOHub {
  public app: express.Application;
  public io!: SocketIO.Server;
  private http!: Server;

  constructor() {
    this.app = express();
    this.http = new Server(this.app);
    this.io = io(this.http);

    this.bindIOEvents();
    this.listen();
  }

  /**
   * Bind events to Socket.IO hub
   */
  private bindIOEvents() {
    this.io.on('connection', (socket: io.Socket) => {

      /**
       * Chat related events
       */
      socket.on('chatMessage', (userWithMessage: any) => this.onChatMessage(userWithMessage));
      socket.on('userLeft', (username: string) => this.onUserLeftChannel(username));
      socket.on('userJoined', (username: string) => this.onUserJoinedChannel(username));

      /**
       * Alert related events
       */
      socket.on('newFollow', (follower: any) => this.onNewFollow(follower));
      socket.on('newSubscription', (subscriber: any, isRenewal: boolean, isGift: boolean) => this.onNewSubscription(subscriber, isRenewal, isGift));
      socket.on('newRaid', (raid: string) => this.onNewRaid(raid));
      socket.on('newCheer', (cheer: any) => this.onNewCheer(cheer));
    });
  }

  private onChatMessage(userWithMessage: any) {
    const chatMessage = userWithMessage[0];
    log('info', `onChatMessage: ${chatMessage.message}`);
    this.io.emit('chatMessage', chatMessage);
  }

  private onUserJoinedChannel(username: string) {
    log('info', `onUserJoinedChannel: ${username}`);
    this.io.emit('userJoined', username);
  }

  private onUserLeftChannel(username: string) {
    log('info', `onUserLeftChannel: ${username}`);
    this.io.emit('userLeft', username);
  }

  private onNewFollow(follower: any) {
    log('info', `onNewFollow: ${follower.user}`);
    this.io.emit('newFollow', follower);
  }

  private onNewSubscription(subscriber: any, isRenewal: boolean, isGift: boolean) {
    log('info', `onNewSubscription: ${subscriber.user}`);
    this.io.emit('newSubscription', subscriber, isRenewal, isGift);
  }

  private onNewRaid(raid: string) {
    log('info', `onNewRaid: ${raid}`);
    this.io.emit('newRaid', raid);
  }

  private onNewCheer(cheer: any) {
    log('info', `onNewCheer: ${cheer.user}`);
    this.io.emit('newCheer', cheer);
  }

  /**
   * Start the Node.js server
   */
  private listen = (): void => {
    this.http.listen(80, () => {
      log('info', 'listening on *:80');
    });
  };
}
