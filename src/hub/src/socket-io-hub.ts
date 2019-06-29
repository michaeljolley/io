import express = require('express');
import { Server } from 'http';
import io from 'socket.io';

import { log } from './common';

import {
  ICandle,
  ICandleVoteResult,
  IStream,
  IUserInfo,
  IVote,
  ISubscriber,
  IRaider,
  ICheer
} from './models';

export class IOHub {
  public app: express.Application;
  public io!: SocketIO.Server;
  private http!: Server;

  constructor() {
    this.app = express();
    this.http = new Server(this.app);
    this.io = io(this.http);

    this.bindIOEvents();
  }

  public start() {
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
      socket.on('emote', (emoteUrl: string) => this.onEmote(emoteUrl));
      socket.on('userLeft', (username: string) => this.onUserLeftChannel(username));
      socket.on('userJoined', (username: string) => this.onUserJoinedChannel(username));

      /**
       * Chron related events
       */
      socket.on('followerCount', (followerCount: number) => this.onFollowerCount(followerCount));
      socket.on('viewerCount', (viewerCount: number) => this.onViewerCount(viewerCount));
      socket.on('lastFollower', (lastFollower: IUserInfo[]) => this.onLastFollower(lastFollower[0]));
      socket.on('lastSubscriber', (lastSubscriber: IUserInfo[]) => this.onLastSubscriber(lastSubscriber[0]));

      /**
       * Stream start/stop events
       */
      socket.on('streamStart', (activeStream: IStream[]) => this.onStreamStart(activeStream[0]));
      socket.on('streamUpdate', (activeStream: IStream[]) => this.onStreamUpdate(activeStream[0]));
      socket.on('streamEnd', (activeStream: IStream[]) => this.onStreamEnd(activeStream[0]));

      /**
       * Alert related events
       */
      socket.on('newFollow', (streamId: string, follower: IUserInfo) => this.onNewFollow(streamId, follower));
      socket.on('newSubscription', (streamId: string, subscriber: ISubscriber) => this.onNewSubscription(streamId, subscriber));
      socket.on('newRaid', (streamId: string, raider: IRaider) => this.onNewRaid(streamId, raider));
      socket.on('newCheer', (streamId: string, cheerer: ICheer) => this.onNewCheer(streamId, cheerer));

      /**
       * User generated events
       */
      socket.on('playAudio', (soundClipName: string) => this.onPlayAudio(soundClipName));
      socket.on('stopAudio', () => this.onStopAudio());

      /**
       * Candle related events
       */
      socket.on('candleReset', (streamId: string[]) => this.onCandleReset(streamId[0]));
      socket.on('candleStop', (streamId: string[]) => this.onCandleStop(streamId[0]));
      socket.on('candleVote', (vote: IVote[]) => this.onCandleVote(vote[0]));
      socket.on('candleWinner', (streamId: string, candle: ICandle) => this.onCandleWinner(streamId, candle));
      socket.on('candleVoteUpdate', (results: ICandleVoteResult[]) => this.onCandleVoteUpdate(results));

    });
  }

  private onChatMessage(userWithMessage: any) {
    const chatMessage = userWithMessage[0];
    log('info', `onChatMessage: ${chatMessage.message}`);
    this.io.emit('chatMessage', chatMessage);
  }

  private onEmote(emoteUrl: string) {
    log('info', `onEmote: ${emoteUrl}`);
    this.io.emit('emote', emoteUrl);
  }

  private onUserJoinedChannel(username: string) {
    log('info', `onUserJoinedChannel: ${username}`);
    this.io.emit('userJoined', username);
  }

  private onUserLeftChannel(username: string) {
    log('info', `onUserLeftChannel: ${username}`);
    this.io.emit('userLeft', username);
  }

  private onNewFollow(streamId: string, follower: IUserInfo) {
    log('info', `onNewFollow: ${follower.login}`);
    this.io.emit('newFollow', streamId, follower);
  }

  private onNewSubscription(streamId: string, subscriber: ISubscriber) {
    log('info', `onNewSubscription: ${subscriber.user.login}`);
    this.io.emit('newSubscription', streamId, subscriber);
  }

  private onNewRaid(streamId: string, raider: IRaider) {
    log('info', `onNewRaid: ${raider.user.login}: ${raider.viewers}`);
    this.io.emit('newRaid', streamId, raider);
  }

  private onNewCheer(streamId: string, cheer: ICheer) {
    log('info', `onNewCheer: ${cheer.user.login} - ${cheer.bits}`);
    this.io.emit('newCheer', streamId, cheer);
  }

  private onFollowerCount(followerCount: number) {
    log('info', `onFollowerCount: ${followerCount}`);
    this.io.emit('followerCount', followerCount);
  }

  private onViewerCount(viewerCount: number) {
    log('info', `onViewerCount: ${viewerCount}`);
    this.io.emit('viewerCount', viewerCount);
  }

  private onLastFollower(lastFollower: IUserInfo) {
    log('info', `onLastFollower: ${lastFollower.login}`);
    this.io.emit('lastFollower', lastFollower);
  }

  private onLastSubscriber(lastSubscriber: IUserInfo) {
    log('info', `onLastSubscriber: ${lastSubscriber.login}`);
    this.io.emit('lastSubscriber', lastSubscriber);
  }

  private onPlayAudio(soundClipName: string) {
    log('info', `onPlayAudio: ${soundClipName}`);
    this.io.emit('playAudio', soundClipName);
  }

  private onStopAudio() {
    log('info', `onStopAudio`);
    this.io.emit('stopAudio');
  }

  private onStreamStart(activeStream: IStream) {
    log('info', `onStreamStart: ${JSON.stringify(activeStream.id)}`);
    this.io.emit('streamStart', activeStream);
  }

  private onStreamUpdate(activeStream: IStream) {
    log('info', `onStreamUpdate: ${JSON.stringify(activeStream.id)}`);
    this.io.emit('streamUpdate', activeStream);
  }

  private onStreamEnd(activeStream: IStream) {
    log('info', `onStreamEnd`);
    this.io.emit('streamEnd', activeStream);
  }

  private onCandleWinner(streamId: string, streamCandle: ICandle) {
    log('info', `onCandleWinner: ${streamId} - ${JSON.stringify(streamCandle)}`);
    this.io.emit('candleWinner', streamId, streamCandle);
  }

  private onCandleStop(streamId: string) {
    log('info', 'onCandleStop');
    this.io.emit('candleStop', streamId);
  }

  private onCandleVote(vote: IVote) {
    log('info', `onCandleVote:`);
    this.io.emit('candleVote', vote);
  }

  private onCandleReset(streamId: string) {
    log('info', 'onCandleReset');
    this.io.emit('candleReset', streamId);
  }

  private onCandleVoteUpdate(results: ICandleVoteResult[]) {
    log('info', 'onCandleVoteUpdate');
    this.io.emit('candleVoteUpdate', results);
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
