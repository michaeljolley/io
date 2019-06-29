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
    this.socket.on('streamEnd', (currentStream: IStream) => this.onStreamEnd(currentStream));

    this.socket.on('newFollow', (streamId: string, follower: IUserInfo) => this.onNewFollow(streamId, follower));
    this.socket.on('newSubscription', (streamId: string, subscriber: ISubscriber) => this.onNewSubscription(streamId, subscriber));
    this.socket.on('newRaid', (streamId: string, raider: IRaider) => this.onNewRaid(streamId, raider));
    this.socket.on('newCheer', (streamId: string, cheerer: ICheer) => this.onNewCheer(streamId, cheerer));

    this.socket.on('candleWinner', (streamId: string, streamCandle: ICandle) => this.onCandleWinner(streamId, streamCandle));
    this.socket.on('candleReset', (streamId: string) => this.onCandleReset(streamId));
    this.socket.on('candleStop', (streamId: string) => this.onCandleStop(streamId));
    this.socket.on('candleVote', (vote: IVote) => this.onCandleVote(vote));
  }

  public start() {}

  private async onStreamStart(currentStream: IStream) {
    await this.streamDb.saveStream(currentStream);
  }

  private async onStreamEnd(currentStream: IStream) {
    // Only need to set the streams ended_at property
    await this.streamDb.saveStream({ id: currentStream.id, ended_at: new Date().toUTCString() });
  }

  private async onStreamUpdate(currentStream: IStream) {
    // Only need to update title
    await this.streamDb.saveStream(currentStream);
  }

  private onNewFollow(streamId: string, follower: IUserInfo) {
    // We want to record the follower on the current stream
  }

  private async onNewRaid(streamId: string, raider: IRaider) {
    // We want to record the raider on the current stream
    await this.streamDb.recordRaid(streamId, raider);
  }

  private async onNewCheer(streamId: string, cheerer: ICheer) {
    // We want to record the cheer on the current stream
    await this.streamDb.recordCheer(streamId, cheerer);
  }

  private async onNewSubscription(streamId: string, subscriber: ISubscriber) {
    // We want to record the subcription on the current stream
    await this.streamDb.recordSubscriber(streamId, subscriber);
  }

  private async onCandleWinner(streamId: string, streamCandle: ICandle) {
    log('info', `onCandleWinner: ${streamId} - ${JSON.stringify(streamCandle)}`);
    // Only need to set the streams candle property
    await this.streamDb.saveStream({ id: streamId, candle: streamCandle });
  }

  private async onCandleReset(streamId: string) {
    log('info', `onCandleReset: ${streamId}`);
    // Only need to set the streams candle property to null
    await this.streamDb.saveStream({ id: streamId, candle: null, candleVotes: [] });
  }

  private async onCandleStop(streamId: string) {
    log('info', `onCandleStop: ${streamId}`);

    const stream: IStream | undefined = await this.streamDb.getStream(streamId);

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
          this.socket.emit('candleWinner', streamId, winner);
        }
      }
    }
  }

  private async onCandleVote(vote: IVote) {
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
