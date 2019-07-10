import express = require('express');
import { Server } from 'http';
import io from 'socket.io';

import { log } from './common';
import {
  IChatMessageEventArg,
  IEmoteEventArg,
  IUserLeftEventArg,
  IUserJoinedEventArg,
  IFollowerCountEventArg,
  IViewerCountEventArg,
  ILastUserEventArg,
  IStreamEventArg,
  INewSubscriptionEventArg,
  INewCheerEventArg,
  INewRaidEventArg,
  INewFollowerEventArg,
  IMediaEventArg,
  ICandleVoteEventArg,
  ICandleWinnerEventArg,
  ICandleVoteResultEventArg
} from './event_args';

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
      socket.on('chatMessage', (chatMessageArg: IChatMessageEventArg) =>
        this.onChatMessage(chatMessageArg)
      );
      socket.on('emote', (emoteArg: IEmoteEventArg) => this.onEmote(emoteArg));
      socket.on('userLeft', (userEvent: IUserLeftEventArg) =>
        this.onUserLeftChannel(userEvent)
      );
      socket.on('userJoined', (userEvent: IUserJoinedEventArg) =>
        this.onUserJoinedChannel(userEvent)
      );

      /**
       * Chron related events
       */
      socket.on('followerCount', (followerCountEvent: IFollowerCountEventArg) =>
        this.onFollowerCount(followerCountEvent)
      );
      socket.on('viewerCount', (viewerCountEvent: IViewerCountEventArg) =>
        this.onViewerCount(viewerCountEvent)
      );
      socket.on('lastFollower', (lastUserEvent: ILastUserEventArg) =>
        this.onLastFollower(lastUserEvent)
      );
      socket.on('lastSubscriber', (lastUserEvent: ILastUserEventArg) =>
        this.onLastSubscriber(lastUserEvent)
      );

      /**
       * Stream start/stop events
       */
      socket.on('streamStart', (streamEvent: IStreamEventArg) =>
        this.onStreamStart(streamEvent)
      );
      socket.on('streamUpdate', (streamEvent: IStreamEventArg) =>
        this.onStreamUpdate(streamEvent)
      );
      socket.on('streamEnd', (streamEvent: IStreamEventArg) =>
        this.onStreamEnd(streamEvent)
      );

      /**
       * Alert related events
       */
      socket.on('newFollow', (newFollowerEvent: INewFollowerEventArg) =>
        this.onNewFollow(newFollowerEvent)
      );
      socket.on(
        'newSubscription',
        (newSubscriptionEvent: INewSubscriptionEventArg) =>
          this.onNewSubscription(newSubscriptionEvent)
      );
      socket.on('newRaid', (newRaidEvent: INewRaidEventArg) =>
        this.onNewRaid(newRaidEvent)
      );
      socket.on('newCheer', (newCheerEvent: INewCheerEventArg) =>
        this.onNewCheer(newCheerEvent)
      );

      /**
       * User generated events
       */
      socket.on('playAudio', (mediaEvent: IMediaEventArg) =>
        this.onPlayAudio(mediaEvent)
      );
      socket.on('stopAudio', () => this.onStopAudio());

      /**
       * Candle related events
       */
      socket.on('candleReset', (streamEvent: IStreamEventArg) =>
        this.onCandleReset(streamEvent)
      );
      socket.on('candleStop', (streamEvent: IStreamEventArg) =>
        this.onCandleStop(streamEvent)
      );
      socket.on('candleVote', (candleVoteEventArg: ICandleVoteEventArg) => this.onCandleVote(candleVoteEventArg));
      socket.on('candleWinner', (candleWinnerEventArg: ICandleWinnerEventArg) =>
        this.onCandleWinner(candleWinnerEventArg)
      );
      socket.on('candleVoteUpdate', (candleVoteResultEventArg: ICandleVoteResultEventArg) =>
        this.onCandleVoteUpdate(candleVoteResultEventArg)
      );
    });
  }

  private onChatMessage(chatMessageArg: IChatMessageEventArg) {
    log('info', `onChatMessage: ${chatMessageArg.message}`);
    this.io.emit('chatMessage', chatMessageArg);
  }

  private onEmote(emoteArg: IEmoteEventArg) {
    log('info', `onEmote: ${emoteArg.emoteUrl}`);
    this.io.emit('emote', emoteArg);
  }

  private onUserJoinedChannel(userEvent: IUserJoinedEventArg) {
    log('info', `onUserJoinedChannel: ${userEvent.username}`);
    this.io.emit('userJoined', userEvent);
  }

  private onUserLeftChannel(userEvent: IUserLeftEventArg) {
    log('info', `onUserLeftChannel: ${userEvent.username}`);
    this.io.emit('userLeft', userEvent);
  }

  private onNewFollow(followerEventArg: INewFollowerEventArg) {
    log('info', `onNewFollow: ${followerEventArg.follower.login}`);
    this.io.emit('newFollow', followerEventArg);
  }

  private onNewSubscription(subscriptionEventArg: INewSubscriptionEventArg) {
    log(
      'info',
      `onNewSubscription: ${subscriptionEventArg.subscriber.user.login}`
    );
    this.io.emit('newSubscription', subscriptionEventArg);
  }

  private onNewRaid(raidEventArg: INewRaidEventArg) {
    log(
      'info',
      `onNewRaid: ${raidEventArg.raider.user.login}: ${
        raidEventArg.raider.viewers
      }`
    );
    this.io.emit('newRaid', raidEventArg);
  }

  private onNewCheer(cheerEventArg: INewCheerEventArg) {
    log(
      'info',
      `onNewCheer: ${cheerEventArg.cheerer.user.login} - ${
        cheerEventArg.cheerer.bits
      }`
    );
    this.io.emit('newCheer', cheerEventArg);
  }

  private onFollowerCount(followerCountArg: IFollowerCountEventArg) {
    log('info', `onFollowerCount: ${followerCountArg.followers}`);
    this.io.emit('followerCount', followerCountArg);
  }

  private onViewerCount(viewerCountEvent: IViewerCountEventArg) {
    log('info', `onViewerCount: ${viewerCountEvent.viewers}`);
    this.io.emit('viewerCount', viewerCountEvent);
  }

  private onLastFollower(lastFollowerEvent: ILastUserEventArg) {
    log('info', `onLastFollower: ${lastFollowerEvent.userInfo.login}`);
    this.io.emit('lastFollower', lastFollowerEvent);
  }

  private onLastSubscriber(lastSubscriberEvent: ILastUserEventArg) {
    log('info', `onLastSubscriber: ${lastSubscriberEvent.userInfo.login}`);
    this.io.emit('lastSubscriber', lastSubscriberEvent);
  }

  private onPlayAudio(mediaEvent: IMediaEventArg) {
    log('info', `onPlayAudio: ${mediaEvent.clipName}`);
    this.io.emit('playAudio', mediaEvent);
  }

  private onStopAudio() {
    log('info', `onStopAudio`);
    this.io.emit('stopAudio');
  }

  private onStreamStart(streamEvent: IStreamEventArg) {
    log('info', `onStreamStart: ${JSON.stringify(streamEvent.stream.id)}`);
    this.io.emit('streamStart', streamEvent);
  }

  private onStreamUpdate(streamEvent: IStreamEventArg) {
    log('info', `onStreamUpdate: ${JSON.stringify(streamEvent.stream.id)}`);
    this.io.emit('streamUpdate', streamEvent);
  }

  private onStreamEnd(streamEvent: IStreamEventArg) {
    log('info', `onStreamEnd: ${JSON.stringify(streamEvent.stream.id)}`);
    this.io.emit('streamEnd', streamEvent);
  }

  private onCandleWinner(candleWinnerEvent: ICandleWinnerEventArg) {
    log(
      'info',
      `onCandleWinner: ${candleWinnerEvent.streamId} - ${candleWinnerEvent.candle.label}`
    );
    this.io.emit('candleWinner', candleWinnerEvent);
  }

  private onCandleStop(streamEvent: IStreamEventArg) {
    log('info', 'onCandleStop');
    this.io.emit('candleStop', streamEvent);
  }

  private onCandleVote(candleVoteEvent: ICandleVoteEventArg) {
    log('info', `onCandleVote: ${candleVoteEvent.userInfo.login} - ${candleVoteEvent.candle.label}`);
    this.io.emit('candleVote', candleVoteEvent);
  }

  private onCandleReset(streamEvent: IStreamEventArg) {
    log('info', 'onCandleReset');
    this.io.emit('candleReset', streamEvent);
  }

  private onCandleVoteUpdate(candleVoteResultEventArg: ICandleVoteResultEventArg) {
    log('info', 'onCandleVoteUpdate');
    this.io.emit('candleVoteUpdate', candleVoteResultEventArg);
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
