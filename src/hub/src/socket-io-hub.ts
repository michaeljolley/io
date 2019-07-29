import express = require('express');
import { Server } from 'http';
import io from 'socket.io';

import { SocketIOEvents } from '@shared/events';
import { log } from '@shared/common';
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
  ICandleVoteResultEventArg,
  INewSegmentEventArg,
  IUserEventArg,
  IThemerEventArg,
  INewGoalEventArg,
  INewNoteEventArg,
  INewAnnouncementEventArg
} from '@shared/event_args';

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
      socket.on(SocketIOEvents.OnChatMessage, (chatMessageArg: IChatMessageEventArg) =>
        this.onChatMessage(chatMessageArg)
      );
      socket.on(SocketIOEvents.EmoteSent, (emoteArg: IEmoteEventArg) => this.onEmote(emoteArg));
      socket.on(SocketIOEvents.OnUserLeft, (userEvent: IUserLeftEventArg) =>
        this.onUserLeftChannel(userEvent)
      );
      socket.on(SocketIOEvents.OnUserJoined, (userEvent: IUserJoinedEventArg) =>
        this.onUserJoinedChannel(userEvent)
      );

      /**
       * Chron related events
       */
      socket.on(SocketIOEvents.FollowerCountChanged, (followerCountEvent: IFollowerCountEventArg) =>
        this.onFollowerCount(followerCountEvent)
      );
      socket.on(SocketIOEvents.ViewerCountChanged, (viewerCountEvent: IViewerCountEventArg) =>
        this.onViewerCount(viewerCountEvent)
      );
      socket.on(SocketIOEvents.LastFollowerUpdated, (lastUserEvent: ILastUserEventArg) =>
        this.onLastFollower(lastUserEvent)
      );
      socket.on(SocketIOEvents.LastSubscriberUpdated, (lastUserEvent: ILastUserEventArg) =>
        this.onLastSubscriber(lastUserEvent)
      );

      /**
       * Stream start/stop events
       */
      socket.on(SocketIOEvents.StreamStarted, (streamEvent: IStreamEventArg) =>
        this.onStreamStart(streamEvent)
      );
      socket.on(SocketIOEvents.StreamUpdated, (streamEvent: IStreamEventArg) =>
        this.onStreamUpdate(streamEvent)
      );
      socket.on(SocketIOEvents.StreamEnded, (streamEvent: IStreamEventArg) =>
        this.onStreamEnd(streamEvent)
      );
      socket.on(SocketIOEvents.StreamNoteRebuild, (streamId: string) =>
      this.onStreamNoteRebuild(streamId)
    );

      /**
       * Alert related events
       */
      socket.on(SocketIOEvents.NewFollower, (newFollowerEvent: INewFollowerEventArg) =>
        this.onNewFollow(newFollowerEvent)
      );
      socket.on(
        SocketIOEvents.NewSubscriber,
        (newSubscriptionEvent: INewSubscriptionEventArg) =>
          this.onNewSubscription(newSubscriptionEvent)
      );
      socket.on(SocketIOEvents.NewRaid, (newRaidEvent: INewRaidEventArg) =>
        this.onNewRaid(newRaidEvent)
      );
      socket.on(SocketIOEvents.NewCheer, (newCheerEvent: INewCheerEventArg) =>
        this.onNewCheer(newCheerEvent)
      );
      socket.on(
        SocketIOEvents.NewAnnouncement,
        (newAnnouncementEvent: INewAnnouncementEventArg) =>
          this.onNewAnnouncement(newAnnouncementEvent)
      );

      /**
       * User generated events
       */
      socket.on(SocketIOEvents.PlayAudio, (mediaEvent: IMediaEventArg) =>
        this.onPlayAudio(mediaEvent)
      );
      socket.on(SocketIOEvents.StopAudio, () => this.onStopAudio());
      socket.on(SocketIOEvents.NewSegment, (segmentEvent: INewSegmentEventArg) =>
        this.onNewSegment(segmentEvent)
      );
      socket.on(SocketIOEvents.TwitchThemer, (themerEvent: IThemerEventArg) =>
        this.onTwitchThemer(themerEvent)
      );
      socket.on(SocketIOEvents.OnModeratorJoined, (userEvent: IUserEventArg) =>
        this.onModeratorJoined(userEvent)
      );
      socket.on(SocketIOEvents.NewNote, (noteEvent: INewNoteEventArg) =>
        this.newNote(noteEvent)
      );
      socket.on(SocketIOEvents.NewGoal, (goalEvent: INewGoalEventArg) =>
        this.newGoal(goalEvent)
      );

      /**
       * Candle related events
       */
      socket.on(SocketIOEvents.CandleReset, (streamEvent: IStreamEventArg) =>
        this.onCandleReset(streamEvent)
      );
      socket.on(SocketIOEvents.CandleVoteStart, (streamEvent: IStreamEventArg) =>
        this.onCandleStart(streamEvent)
      );
      socket.on(SocketIOEvents.CandleVoteStop, (streamEvent: IStreamEventArg) =>
        this.onCandleStop(streamEvent)
      );
      socket.on(SocketIOEvents.CandleVote, (candleVoteEventArg: ICandleVoteEventArg) =>
        this.onCandleVote(candleVoteEventArg)
      );
      socket.on(SocketIOEvents.CandleWinner, (candleWinnerEventArg: ICandleWinnerEventArg) =>
        this.onCandleWinner(candleWinnerEventArg)
      );
      socket.on(
        SocketIOEvents.CandleVoteUpdate,
        (candleVoteResultEventArg: ICandleVoteResultEventArg) =>
          this.onCandleVoteUpdate(candleVoteResultEventArg)
      );
    });
  }

  private onChatMessage(chatMessageArg: IChatMessageEventArg) {
    log('info', `onChatMessage: ${chatMessageArg.message}`);
    this.io.emit(SocketIOEvents.OnChatMessage, chatMessageArg);
  }

  private onEmote(emoteArg: IEmoteEventArg) {
    log('info', `onEmote: ${emoteArg.emoteUrl}`);
    this.io.emit(SocketIOEvents.EmoteSent, emoteArg);
  }

  private onUserJoinedChannel(userEvent: IUserJoinedEventArg) {
    log('info', `onUserJoinedChannel: ${userEvent.username}`);
    this.io.emit(SocketIOEvents.OnUserJoined, userEvent);
  }

  private onUserLeftChannel(userEvent: IUserLeftEventArg) {
    log('info', `onUserLeftChannel: ${userEvent.username}`);
    this.io.emit(SocketIOEvents.OnUserLeft, userEvent);
  }

  private onNewFollow(followerEventArg: INewFollowerEventArg) {
    log('info', `onNewFollow: ${followerEventArg.follower.login}`);
    this.io.emit(SocketIOEvents.NewFollower, followerEventArg);
  }

  private onNewSubscription(subscriptionEventArg: INewSubscriptionEventArg) {
    log(
      'info',
      `onNewSubscription: ${subscriptionEventArg.subscriber.user.login}`
    );
    this.io.emit(SocketIOEvents.NewSubscriber, subscriptionEventArg);
  }

  private onNewRaid(raidEventArg: INewRaidEventArg) {
    log(
      'info',
      `onNewRaid: ${raidEventArg.raider.user.login}: ${
        raidEventArg.raider.viewers
      }`
    );
    this.io.emit(SocketIOEvents.NewRaid, raidEventArg);
  }

  private onNewCheer(cheerEventArg: INewCheerEventArg) {
    log(
      'info',
      `onNewCheer: ${cheerEventArg.cheerer.user.login} - ${
        cheerEventArg.cheerer.bits
      }`
    );
    this.io.emit(SocketIOEvents.NewCheer, cheerEventArg);
  }

  private onNewAnnouncement(newAnnouncementEvent: INewAnnouncementEventArg) {
    log('info', `onNewAnnouncement: ${newAnnouncementEvent.message}`);
    this.io.emit(SocketIOEvents.NewAnnouncement, newAnnouncementEvent);
  }

  private onFollowerCount(followerCountArg: IFollowerCountEventArg) {
    log('info', `onFollowerCount: ${followerCountArg.followers}`);
    this.io.emit(SocketIOEvents.FollowerCountChanged, followerCountArg);
  }

  private onViewerCount(viewerCountEvent: IViewerCountEventArg) {
    log('info', `onViewerCount: ${viewerCountEvent.viewers}`);
    this.io.emit(SocketIOEvents.ViewerCountChanged, viewerCountEvent);
  }

  private onLastFollower(lastFollowerEvent: ILastUserEventArg) {
    log('info', `onLastFollower: ${lastFollowerEvent.userInfo.login}`);
    this.io.emit(SocketIOEvents.LastFollowerUpdated, lastFollowerEvent);
  }

  private onLastSubscriber(lastSubscriberEvent: ILastUserEventArg) {
    log('info', `onLastSubscriber: ${lastSubscriberEvent.userInfo.login}`);
    this.io.emit(SocketIOEvents.LastSubscriberUpdated, lastSubscriberEvent);
  }

  private onNewSegment(segmentEvent: INewSegmentEventArg) {
    log('info', `onNewSegment: ${segmentEvent.streamSegment.topic}`);
    this.io.emit(SocketIOEvents.NewSegment, segmentEvent);
  }

  private onPlayAudio(mediaEvent: IMediaEventArg) {
    log('info', `onPlayAudio: ${mediaEvent.clipName}`);
    this.io.emit(SocketIOEvents.PlayAudio, mediaEvent);
  }

  private onTwitchThemer(themerEvent: IThemerEventArg) {
    log('info', `onTwitchThemer: ${themerEvent.user.login}`);
    this.io.emit(SocketIOEvents.TwitchThemer, themerEvent);
  }

  private onModeratorJoined(userEvent: IUserEventArg) {
    log('info', `onModeratorJoined: ${userEvent.user.login}`);
    this.io.emit(SocketIOEvents.OnModeratorJoined, userEvent);
  }

  private newNote(noteEvent: INewNoteEventArg) {
    log('info', `newNote: ${noteEvent.streamNote.user.login}`);
    this.io.emit(SocketIOEvents.NewNote, noteEvent);
  }

  private newGoal(goalEvent: INewGoalEventArg) {
    log('info', `newGoal: ${goalEvent.streamGoal.name}`);
    this.io.emit(SocketIOEvents.NewGoal, goalEvent);
  }

  private onStopAudio() {
    log('info', `onStopAudio`);
    this.io.emit(SocketIOEvents.StopAudio);
  }

  private onStreamStart(streamEvent: IStreamEventArg) {
    log('info', `onStreamStart: ${JSON.stringify(streamEvent.stream.id)}`);
    this.io.emit(SocketIOEvents.StreamStarted, streamEvent);
  }

  private onStreamUpdate(streamEvent: IStreamEventArg) {
    log('info', `onStreamUpdate: ${JSON.stringify(streamEvent.stream.id)}`);
    this.io.emit(SocketIOEvents.StreamUpdated, streamEvent);
  }

  private onStreamEnd(streamEvent: IStreamEventArg) {
    log('info', `onStreamEnd: ${JSON.stringify(streamEvent.stream.id)}`);
    this.io.emit(SocketIOEvents.StreamEnded, streamEvent);
  }

  private onStreamNoteRebuild(streamId: string) {
    log('info', `onStreamNoteRebuild: ${JSON.stringify(streamId)}`);
    this.io.emit(SocketIOEvents.StreamNoteRebuild, streamId);
  }

  private onCandleWinner(candleWinnerEvent: ICandleWinnerEventArg) {
    log(
      'info',
      `onCandleWinner: ${candleWinnerEvent.streamId} - ${
        candleWinnerEvent.candle.label
      }`
    );
    this.io.emit(SocketIOEvents.CandleWinner, candleWinnerEvent);
  }

  private onCandleStart(streamEvent: IStreamEventArg) {
    log('info', 'onCandleStart');
    this.io.emit(SocketIOEvents.CandleVoteStart, streamEvent);
  }

  private onCandleStop(streamEvent: IStreamEventArg) {
    log('info', 'onCandleStop');
    this.io.emit(SocketIOEvents.CandleVoteStop, streamEvent);
  }

  private onCandleVote(candleVoteEvent: ICandleVoteEventArg) {
    log(
      'info',
      `onCandleVote: ${candleVoteEvent.userInfo.login} - ${
        candleVoteEvent.candle.label
      }`
    );
    this.io.emit(SocketIOEvents.CandleVote, candleVoteEvent);
  }

  private onCandleReset(streamEvent: IStreamEventArg) {
    log('info', 'onCandleReset');
    this.io.emit(SocketIOEvents.CandleReset, streamEvent);
  }

  private onCandleVoteUpdate(
    candleVoteResultEventArg: ICandleVoteResultEventArg
  ) {
    log('info', 'onCandleVoteUpdate');
    this.io.emit(SocketIOEvents.CandleVoteUpdate, candleVoteResultEventArg);
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
