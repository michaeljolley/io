import io from 'socket.io-client';
import { log } from './common';
import _ from 'lodash';

import {
  IUserInfo,
  IRaider,
  ICheer,
  ISubscriber,
  ICandle,
  IStream,
  ICandleVote,
  ICandleVoteResult,
  IVote} from './models';
  import { CandleDb, StreamDb } from './db';

export class Logger {

  private socket!: SocketIOClient.Socket;
  private streamDb: StreamDb;
  private candleDb: CandleDb;

  constructor() {
    this.socket = io('http://hub');
    this.streamDb = new StreamDb();
    this.candleDb = new CandleDb();

    this.socket.on('streamStart', (currentStream: IStream) => this.onStreamStart(currentStream));
    this.socket.on('streamUpdate', (currentStream: IStream) => this.onStreamUpdate(currentStream));
    this.socket.on('streamEnd', (streamId: string) => this.onStreamEnd(streamId));

    this.socket.on('newFollow', (follower: IUserInfo) => this.onNewFollow(follower));
    this.socket.on('newSubscription', (subscriber: ISubscriber) => this.onNewSubscription(subscriber));
    this.socket.on('newRaid', (raider: IRaider) => this.onNewRaid(raider));
    this.socket.on('newCheer', (cheerer: ICheer) => this.onNewCheer(cheerer));

    this.socket.on('candleWinner', (streamId: string, streamCandle: ICandle) => this.onCandleWinner(streamId, streamCandle));
    this.socket.on('candleReset', (streamId: string) => this.onCandleReset(streamId));
    this.socket.on('candleStop', (streamId: string) => this.onCandleStop(streamId));
    this.socket.on('candleVote', (vote: IVote) => this.onCandleVote(vote));
  }

  public start() {
  }

  private async onStreamStart(currentStream: IStream) {
    await this.streamDb.saveStream(currentStream);
  }

  private async onStreamEnd(streamId: string) {
    // Only need to set the streams ended_at property
    await this.streamDb.saveStream({ id: streamId, ended_at: new Date().toUTCString() });
  }

  private async onStreamUpdate(currentStream: IStream) {
    // Only need to update title
    await this.streamDb.saveStream(currentStream);
  }

  private onNewFollow(follower: IUserInfo) {
    // We want to record the follower on the current stream
  }

  private onNewRaid(raider: IRaider) {
    // We want to record the raider on the current stream
  }

  private onNewCheer(cheerer: ICheer) {

  }

  private onNewSubscription(subscriber: ISubscriber) {

  }

  private async onCandleWinner(streamId: string, streamCandle: ICandle) {
    // Only need to set the streams candle property
    await this.streamDb.saveStream({ id: streamId, candle: streamCandle });
  }

  private async onCandleReset(streamId: string) {
    // Only need to set the streams candle property to null
    await this.streamDb.saveStream({ id: streamId, candle: null, candleVotes: [] });
  }

  private async onCandleStop(streamId: string) {

    const stream: IStream | undefined = await this.streamDb.getStream(streamId);

    if (stream) {
      const votes: ICandleVote[] | undefined = stream.candleVotes;

      if (votes && votes.length > 0) {

        const candles: ICandle[] = await this.candleDb.getCandles();

        const results = tabulateResults(candles, votes);

        const winner: ICandleVoteResult = results.reduce((l: any, e: any) => {
          return e.votes > l.votes ? e : l;
        });

        this.socket.emit('candleWinner', winner);
      }
    }
  }

  private async onCandleVote(vote: IVote) {
    log('info', `onCandleVote: ${JSON.stringify(vote)}}`);

    await this.streamDb.recordCandleVote(vote);

    // tablulate current results & emit
    const candles: ICandle[] = await this.candleDb.getCandles();
    const stream: IStream | null | undefined = await this.streamDb.getStream(vote.streamId);

    if (stream && stream.candleVotes) {
      const results = tabulateResults(candles, stream.candleVotes);
      this.socket.emit('candleVoteUpdate', results);
    }
  }
}

const tabulateResults = (candles: ICandle[], votes: ICandleVote[]) : ICandleVoteResult[] => {
  const voteResults: any = _.groupBy(votes, 'candle.name');

  const results: ICandleVoteResult[] = [];

  for (const key of Object.keys(voteResults)) {
    const candleVoteResult: ICandleVoteResult | undefined = candles.find((f: any) => f.name === key);
    if (candleVoteResult) {
      candleVoteResult.votes = voteResults[key].length;
      results.push(candleVoteResult);
    }
  }

  log('info', `tabulateResults: ${JSON.stringify(results)}`);
  return results;
};

