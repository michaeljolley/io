import io from 'socket.io-client';
import _ from 'lodash';

import { log } from './common';
import { IStreamEventArg, INewFollowerEventArg, INewSubscriptionEventArg, INewRaidEventArg, INewCheerEventArg, ICandleWinnerEventArg, ICandleVoteEventArg, ICandleVoteResultEventArg } from './event_args';
import { CandleDb, StreamDb } from './db';
import { IStream, ICandleVote, ICandle, ICandleVoteResult, IVote } from './models/index';

export class Logger {

  private socket!: SocketIOClient.Socket;
  private streamDb: StreamDb;
  private candleDb: CandleDb;

  constructor() {
    this.socket = io('http://hub');
    this.streamDb = new StreamDb();
    this.candleDb = new CandleDb();

    this.socket.on('streamStart', (streamEvent: IStreamEventArg) => this.onStreamStart(streamEvent));
    this.socket.on('streamUpdate', (streamEvent: IStreamEventArg) => this.onStreamUpdate(streamEvent));
    this.socket.on('streamEnd', (streamEvent: IStreamEventArg) => this.onStreamEnd(streamEvent));

    this.socket.on('newFollow', (newFollowerEvent: INewFollowerEventArg) => this.onNewFollow(newFollowerEvent));
    this.socket.on('newSubscription', (newSubscriberEvent: INewSubscriptionEventArg) => this.onNewSubscription(newSubscriberEvent));
    this.socket.on('newRaid', (newRaidEvent: INewRaidEventArg) => this.onNewRaid(newRaidEvent));
    this.socket.on('newCheer', (newCheerEvent: INewCheerEventArg) => this.onNewCheer(newCheerEvent));

    this.socket.on('candleWinner', (candleWinnerEvent: ICandleWinnerEventArg) => this.onCandleWinner(candleWinnerEvent));
    this.socket.on('candleReset', (streamEvent: IStreamEventArg) => this.onCandleReset(streamEvent));
    this.socket.on('candleStop', (streamEvent: IStreamEventArg) => this.onCandleStop(streamEvent));
    this.socket.on('candleVote', (candleVoteEventArg: ICandleVoteEventArg) => this.onCandleVote(candleVoteEventArg));
  }

  public start() {}

  private async onStreamStart(streamEvent: IStreamEventArg) {
    await this.streamDb.saveStream(streamEvent.stream);
  }

  private async onStreamEnd(streamEvent: IStreamEventArg) {
    // Only need to set the streams ended_at property
    await this.streamDb.saveStream({ id: streamEvent.stream.id, ended_at: new Date().toUTCString() });
  }

  private async onStreamUpdate(streamEvent: IStreamEventArg) {
    // Only need to update title
    await this.streamDb.saveStream(streamEvent.stream);
  }

  private async onNewFollow(newFollowerEvent: INewFollowerEventArg) {
    // We want to record the follower on the current stream
    await this.streamDb.recordFollower(newFollowerEvent.streamId, newFollowerEvent.follower);
  }

  private async onNewRaid(newRaidEvent: INewRaidEventArg) {
    // We want to record the raider on the current stream
    await this.streamDb.recordRaid(newRaidEvent.streamId, newRaidEvent.raider);
  }

  private async onNewCheer(newCheerEvent: INewCheerEventArg) {
    // We want to record the cheer on the current stream
    await this.streamDb.recordCheer(newCheerEvent.streamId, newCheerEvent.cheerer);
  }

  private async onNewSubscription(newSubscriptionEvent: INewSubscriptionEventArg) {
    // We want to record the subcription on the current stream
    await this.streamDb.recordSubscriber(newSubscriptionEvent.streamId, newSubscriptionEvent.subscriber);
  }

  private async onCandleWinner(candleWinnerEvent: ICandleWinnerEventArg) {
    log('info', `onCandleWinner: ${candleWinnerEvent.streamId} - ${candleWinnerEvent.candle.label}`);
    // Only need to set the streams candle property
    await this.streamDb.saveStream({ id: candleWinnerEvent.streamId, candle: candleWinnerEvent.candle });
  }

  private async onCandleReset(streamEvent: IStreamEventArg) {
    log('info', `onCandleReset: ${streamEvent.stream.id}`);
    // Only need to set the streams candle property to null
    await this.streamDb.saveStream({ id: streamEvent.stream.id, candle: null, candleVotes: [] });
  }

  private async onCandleStop(streamEvent: IStreamEventArg) {
    log('info', `onCandleStop: ${streamEvent.stream.id}`);

    const stream: IStream | undefined = await this.streamDb.getStream(streamEvent.stream.id);

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
            candle: winner,
            streamId: streamEvent.stream.id
          };

          this.socket.emit('candleWinner', candleWinnerEventArg);
        }
      }
    }
  }

  private async onCandleVote(candleVoteEvent: ICandleVoteEventArg) {

    const vote: IVote = {
      candle: candleVoteEvent.candle,
      streamId: candleVoteEvent.streamId,
      user: candleVoteEvent.userInfo
    };

    await this.streamDb.recordCandleVote(vote);

    // tablulate current results & emit
    const candles: ICandle[] = await this.candleDb.getCandles();
    const stream: IStream | null | undefined = await this.streamDb.getStream(candleVoteEvent.streamId);

    if (stream && stream.candleVotes) {

      const candleVoteResultEvent: ICandleVoteResultEventArg = {
        candles,
        streamId: stream.id,
        voteResults: tabulateResults(candles, stream.candleVotes)
      };
      this.socket.emit('candleVoteUpdate', candleVoteResultEvent);
    }
  }
}

const tabulateResults = (candles: ICandle[], votes: ICandleVote[]) : ICandleVoteResult[] => {
  const voteResults: any = _.groupBy(votes, 'candle.name');

  const results: ICandleVoteResult[] = [];

  for (const key of Object.keys(voteResults)) {
    const candleVoteResult: ICandleVoteResult = candles.find((f: any) => f.name === key) as ICandleVoteResult;
    if (candleVoteResult) {
      log('info', `${key}: ${voteResults[key].length}`);
      candleVoteResult.votes = voteResults[key].length;
      results.push(candleVoteResult);
    }
  }

  log('info', `tabulateResults: ${JSON.stringify(results)}`);
  return results;
};
