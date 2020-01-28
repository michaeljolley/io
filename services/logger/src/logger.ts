import io from 'socket.io-client';
import _ from 'lodash';

import { SocketIOEvents } from '@shared/events';
import { log } from '@shared/common';
import {
  IStreamEventArg,
  INewFollowerEventArg,
  INewSubscriptionEventArg,
  INewRaidEventArg,
  INewCheerEventArg,
  ICandleWinnerEventArg,
  ICandleVoteEventArg,
  ICandleVoteResultEventArg,
  INewSegmentEventArg,
  IMediaEventArg,
  IThemerEventArg,
  IUserEventArg,
  IStreamRepoChangedEventArg,
  INewNoteEventArg,
  INewGoalEventArg,
  IChatMessageEventArg,
  ICharityCountEventArg,
  ICharityDetailEventArg
} from '@shared/event_args';
import { CandleDb, StreamDb } from '@shared/db';
import {
  IStream,
  ICandleVote,
  ICandle,
  ICandleVoteResult,
  IChatMessage,
  IVote,
  IGifter,
  IUserInfo
} from '@shared/models';

export class Logger {
  private socket!: SocketIOClient.Socket;
  private streamDb: StreamDb;
  private candleDb: CandleDb;

  constructor() {
    this.socket = io('http://hub');
    this.streamDb = new StreamDb();
    this.candleDb = new CandleDb();

    this.socket.on(
      SocketIOEvents.StreamStarted,
      (streamEvent: IStreamEventArg) => this.onStreamStart(streamEvent)
    );
    this.socket.on(
      SocketIOEvents.StreamUpdated,
      (streamEvent: IStreamEventArg) => this.onStreamUpdate(streamEvent)
    );
    this.socket.on(SocketIOEvents.StreamEnded, (streamEvent: IStreamEventArg) =>
      this.onStreamEnd(streamEvent)
    );

    this.socket.on(
      SocketIOEvents.OnRaidStream,
      (newStreamRaidEvent: INewSegmentEventArg) =>
        this.onStreamSegment(newStreamRaidEvent)
    );

    this.socket.on(
      SocketIOEvents.StreamRepoChanged,
      (streamRepoChangedEvent: IStreamRepoChangedEventArg) =>
        this.onStreamRepoChanged(streamRepoChangedEvent)
    );

    this.socket.on(
      SocketIOEvents.NewFollower,
      (newFollowerEvent: INewFollowerEventArg) =>
        this.onNewFollow(newFollowerEvent)
    );
    this.socket.on(
      SocketIOEvents.NewSubscriber,
      (newSubscriberEvent: INewSubscriptionEventArg) =>
        this.onNewSubscription(newSubscriberEvent)
    );
    this.socket.on(SocketIOEvents.NewRaid, (newRaidEvent: INewRaidEventArg) =>
      this.onNewRaid(newRaidEvent)
    );
    this.socket.on(
      SocketIOEvents.NewCheer,
      (newCheerEvent: INewCheerEventArg) => this.onNewCheer(newCheerEvent)
    );
    this.socket.on(
      SocketIOEvents.OnChatMessage,
      (chatMessageEvent: IChatMessageEventArg) =>
        this.onChatMessage(chatMessageEvent)
    );

    this.socket.on(
      SocketIOEvents.CandleWinner,
      (candleWinnerEvent: ICandleWinnerEventArg) =>
        this.onCandleWinner(candleWinnerEvent)
    );
    this.socket.on(SocketIOEvents.CandleReset, (streamEvent: IStreamEventArg) =>
      this.onCandleReset(streamEvent)
    );
    this.socket.on(
      SocketIOEvents.CandleVoteStop,
      (streamEvent: IStreamEventArg) => this.onCandleStop(streamEvent)
    );
    this.socket.on(
      SocketIOEvents.CandleVote,
      (candleVoteEventArg: ICandleVoteEventArg) =>
        this.onCandleVote(candleVoteEventArg)
    );

    this.socket.on(SocketIOEvents.PlayAudio, (mediaEventArg: IMediaEventArg) =>
      this.onPlayAudio(mediaEventArg)
    );
    this.socket.on(
      SocketIOEvents.TwitchThemer,
      (themerEventArg: IThemerEventArg) => this.onTwitchThemer(themerEventArg)
    );
    this.socket.on(
      SocketIOEvents.OnModeratorJoined,
      (userEventArg: IUserEventArg) => this.onModeratorJoined(userEventArg)
    );
    this.socket.on(SocketIOEvents.NewNote, (noteEvent: INewNoteEventArg) =>
      this.newNote(noteEvent)
    );
    this.socket.on(SocketIOEvents.NewGoal, (goalEvent: INewGoalEventArg) =>
      this.newGoal(goalEvent)
    );
    this.socket.on(
      SocketIOEvents.NewSegment,
      (streamSegmentEvent: INewSegmentEventArg) =>
        this.onStreamSegment(streamSegmentEvent)
    );
  }

  public start() {}

  private async onStreamStart(streamEvent: IStreamEventArg) {
    await this.streamDb.saveStream(streamEvent.stream);
    await this.announceCharity(false);
  }

  private async onStreamEnd(streamEvent: IStreamEventArg) {
    // Only need to set the streams ended_at property
    await this.streamDb.saveStream({
      ended_at: new Date().toISOString(),
      streamDate: streamEvent.stream.streamDate
    });
  }

  private async onStreamUpdate(streamEvent: IStreamEventArg) {
    // Only need to update title
    await this.streamDb.saveStream(streamEvent.stream);
    await this.announceCharity(false);
  }

  private async onNewFollow(newFollowerEvent: INewFollowerEventArg) {
    // We want to record the follower on the current stream
    await this.streamDb.recordUser(
      newFollowerEvent.streamDate,
      'followers',
      newFollowerEvent.follower
    );
  }

  private async onChatMessage(chatMessageEvent: IChatMessageEventArg) {
    // We want to record the follower on the current stream

    const chatMessage: IChatMessage = {
      message: chatMessageEvent.message,
      timestamp: new Date(),
      user: chatMessageEvent.userInfo
    };

    await this.streamDb.recordChatMessage(
      chatMessageEvent.streamDate,
      chatMessage
    );
  }

  private async onNewRaid(newRaidEvent: INewRaidEventArg) {
    // We want to record the raider on the current stream
    await this.streamDb.recordRaid(
      newRaidEvent.streamDate,
      newRaidEvent.raider
    );
  }

  private async onNewCheer(newCheerEvent: INewCheerEventArg) {
    // We want to record the cheer on the current stream
    await this.streamDb.recordCheer(
      newCheerEvent.streamDate,
      newCheerEvent.cheerer
    );
    await this.announceCharity(true);
  }

  private async onNewSubscription(
    newSubscriptionEvent: INewSubscriptionEventArg
  ) {
    // We want to record the subcription on the current stream
    await this.streamDb.recordSubscriber(
      newSubscriptionEvent.streamDate,
      newSubscriptionEvent.subscriber
    );
    await this.announceCharity(true);
  }

  private async onPlayAudio(mediaEventArg: IMediaEventArg) {
    // We want to record the user as a contributor on the current stream
    await this.streamDb.recordUser(
      mediaEventArg.streamDate,
      'contributors',
      mediaEventArg.user
    );
  }

  private async onStreamRepoChanged(
    streamRepoChangedEvent: IStreamRepoChangedEventArg
  ) {
    // We want to record the repo on the current stream
    await this.streamDb.recordRepo(
      streamRepoChangedEvent.stream.streamDate,
      streamRepoChangedEvent.repo
    );
  }

  private async onTwitchThemer(themerEventArg: IThemerEventArg) {
    // We want to record the user as a contributor on the current stream
    await this.streamDb.recordUser(
      themerEventArg.streamDate,
      'contributors',
      themerEventArg.user
    );
  }

  private async onModeratorJoined(userEventArg: IUserEventArg) {
    // We want to record the moderator as being with us
    await this.streamDb.recordUser(
      userEventArg.streamDate,
      'moderators',
      userEventArg.user
    );
  }

  private async onStreamSegment(streamSegmentEvent: INewSegmentEventArg) {
    await this.streamDb.recordSegment(
      streamSegmentEvent.streamDate,
      streamSegmentEvent.streamSegment
    );
  }

  private async newNote(noteEvent: INewNoteEventArg) {
    await this.streamDb.recordNote(noteEvent.streamDate, noteEvent.streamNote);
  }

  private async newGoal(goalEvent: INewGoalEventArg) {
    await this.streamDb.recordNewGoal(
      goalEvent.streamDate,
      goalEvent.streamGoal
    );
  }

  private async onCandleWinner(candleWinnerEvent: ICandleWinnerEventArg) {
    log(
      'info',
      `onCandleWinner: ${candleWinnerEvent.streamDate} - ${candleWinnerEvent.candle.label}`
    );
    // Only need to set the streams candle property
    await this.streamDb.saveStream({
      candle: candleWinnerEvent.candle,
      streamDate: candleWinnerEvent.streamDate
    });
  }

  private async onCandleReset(streamEvent: IStreamEventArg) {
    log('info', `onCandleReset: ${streamEvent.stream.streamDate}`);
    // Only need to set the streams candle property to null
    await this.streamDb.saveStream({
      candle: null,
      candleVotes: [],
      id: streamEvent.stream.streamDate
    });
  }

  private async onCandleStop(streamEvent: IStreamEventArg) {
    log('info', `onCandleStop: ${streamEvent.stream.streamDate}`);

    const stream: IStream | undefined = await this.streamDb.getStream(
      streamEvent.stream.streamDate
    );

    if (stream) {
      const votes: ICandleVote[] | undefined = stream.candleVotes;

      if (votes && votes.length > 0) {
        const candles: ICandle[] = await this.candleDb.getCandles();

        const results = tabulateResults(candles, votes);

        const winner: ICandleVoteResult = results.reduce((l: any, e: any) => {
          return e.votes > l.votes ? e : l;
        });

        log('info', `winner: ${JSON.stringify(winner)}`);
        if (winner) {
          const candleWinnerEventArg: ICandleWinnerEventArg = {
            candle: winner.candle,
            streamDate: streamEvent.stream.streamDate
          };

          this.socket.emit(SocketIOEvents.CandleWinner, candleWinnerEventArg);
        }
      }
    }
  }

  private async onCandleVote(candleVoteEvent: ICandleVoteEventArg) {
    const vote: IVote = {
      candle: candleVoteEvent.candle,
      streamDate: candleVoteEvent.streamDate,
      user: candleVoteEvent.userInfo
    };

    await this.streamDb.recordCandleVote(vote);

    // tabulate current results & emit
    const candles: ICandle[] = await this.candleDb.getCandles();
    const stream: IStream | null | undefined = await this.streamDb.getStream(
      candleVoteEvent.streamDate
    );

    if (stream && stream.candleVotes) {
      const candleVoteResultEvent: ICandleVoteResultEventArg = {
        candles,
        streamDate: stream.streamDate,
        voteResults: tabulateResults(candles, stream.candleVotes)
      };
      this.socket.emit(SocketIOEvents.CandleVoteUpdate, candleVoteResultEvent);
    }
  }

  private gifters: IGifter[] = [];

  private async announceCharity(monkeyDance: boolean): Promise<boolean> {
    const date = new Date();
    const streamData:
      | IStream[]
      | undefined = await this.streamDb.getStreamsByDateRange(
      date.getMonth(),
      date.getFullYear()
    );

    if (streamData) {
      for (let i = 0; i < streamData.length; i++) {
        const stream: IStream = streamData[i];

        if (stream.subscribers) {
          for (let s = 0; s < stream.subscribers.length; s++) {
            this.addGifter(stream.subscribers[s].user, 250);
          }
        }

        if (stream.cheers) {
          for (let c = 0; c < stream.cheers.length; c++) {
            this.addGifter(stream.cheers[c].user, stream.cheers[c].bits);
          }
        }
      }
    }

    const totalAmount: number = _.sum(this.gifters.map(m => m.amount));

    const countEventArg: ICharityCountEventArg = {
      amount: totalAmount
    };

    this.socket.emit(SocketIOEvents.CharityCount, countEventArg);

    if (monkeyDance) {
      const charityDetailEventArg: ICharityDetailEventArg = {
        gifters: this.gifters
      };

      this.socket.emit(SocketIOEvents.CharityDetail, charityDetailEventArg);
    }

    this.gifters = [];
    log('info', `announceCharity: ${totalAmount}`);

    return true;
  }

  private addGifter(user: IUserInfo, amount: number) {
    const gifter: IGifter | undefined = this.gifters.find(
      f => f.user.login === user.login
    );

    if (gifter) {
      gifter.amount = gifter.amount + amount;
    } else {
      const newGifter: IGifter = {
        user,
        amount
      };
      this.gifters.push(newGifter);
    }
  }
}

const tabulateResults = (
  candles: ICandle[],
  votes: ICandleVote[]
): ICandleVoteResult[] => {
  const voteResults = _.groupBy(votes, 'candle.name');

  const results: ICandleVoteResult[] = [];

  for (const key of Object.keys(voteResults)) {
    const candle: any = candles.find((f: any) => f.name === key);
    if (candle) {
      log('info', `${key}: ${voteResults[key].length}`);
      const voteResult: ICandleVoteResult = {
        candle,
        voters: voteResults[key].map(m => m.user),
        votes: voteResults[key].length
      };

      results.push(voteResult);
    }
  }

  log('info', `tabulateResults: ${JSON.stringify(results)}`);
  return results;
};
