import mongodb = require('mongodb');
import io from 'socket.io-client';
import { config, log } from './common';

import {
  IUserInfo,
  IRaider,
  ICheer,
  ISubscriber,
  ICandle,
  IStream,
  IStreamCandle,
  ICandleVote,
  ICandleVoteResult} from './models';
import { isNullOrUndefined } from 'util';

export class Logger {

  private mongoClient = mongodb.MongoClient;
  private socket!: SocketIOClient.Socket;

  constructor() {
    this.socket = io('http://hub');

    this.socket.on('streamStart', this.onStreamStart);
    this.socket.on('streamUpdate', this.onStreamUpdate);
    this.socket.on('streamEnd', this.onStreamEnd);

    this.socket.on('newFollow', this.onNewFollow);
    this.socket.on('newSubscription', this.onNewSubscription);
    this.socket.on('newRaid', this.onNewRaid);
    this.socket.on('newCheer', this.onNewCheer);

    this.socket.on('candleWinner', this.onCandleWinner);
    this.socket.on('candleReset', this.onCandleReset);
    this.socket.on('candleStop', this.onCandleStop);
    this.socket.on('candleVote', this.onCandleVote);
  }

  public start() {
  }

  private async onStreamStart(currentStream: any) {
    let existingStream = await this.getStream(currentStream.streamId);

    if (isNullOrUndefined(existingStream)) {
      const mongoClient: mongodb.MongoClient = await new Promise((resolve: any) =>
      this.mongoClient.connect(config.mongoDBConnectionString, (err, client) => { resolve(client); }));

      const db = mongoClient.db('iodb');

      await db.collection('streams').insertOne(currentStream);

      await mongoClient.close();
    }
  }

  private async onStreamEnd(streamId: string) {
    // Only need to set the streams ended_at property
    await this.updateStream(streamId, { ended_at: new Date().toUTCString() });
  }

  private async onStreamUpdate(currentStream: IStream) {
    // Only need to update title
    await this.updateStream(currentStream.streamId, { title: currentStream.title });
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

  private async onCandleWinner(streamCandle: IStreamCandle) {
    // Only need to set the streams candle property
    await this.updateStream(streamCandle.streamId, { candle: streamCandle.candle });
  }

  private async onCandleReset(streamId: string) {
    // Only need to set the streams candle property to null
    await this.updateStream(streamId, { candle: null, candleVotes: [] });
  }

  private async onCandleStop(streamId: string) {

    const stream: IStream | null | undefined = await this.getStream(streamId);

    if (stream) {
      const votes: ICandleVote[] | null | undefined = stream.candleVotes;

      if (votes && votes.length > 0) {

        const candles: ICandle[] = await this.getCandles();

        const results = tabulateResults(candles, votes);

        log('info', JSON.stringify(results));

        const winner: ICandleVoteResult = results.reduce((l: any, e: any) => {
          return e.votes > l.votes ? e : l;
        });

        this.socket.emit('candleWinner', winner);
      }
    }
  }

  private async onCandleVote(streamId: string, candleVote: ICandleVote) {
    // Save vote
    const mongoClient: mongodb.MongoClient = await new Promise((resolve: any) =>
      mongodb.MongoClient.connect(config.mongoDBConnectionString, (err, client) => { resolve(client); }));

    const db = mongoClient.db('iodb');

    await db.collection('streams').findOneAndUpdate({
            query: { streamId: streamId, candleVotes: { $elemMatch: { username: candleVote.username } } } },
            { $set: { 'candleVotes.$.candleName': candleVote.candleName,
                      'candleVotes.$.username': candleVote.username } },
            { upsert: true }
          );

    // tablulate current results & emit
    const candles: ICandle[] = await this.getCandles();
    const stream: IStream | null | undefined = await this.getStream(streamId);

    if (stream && stream.candleVotes) {
      const results = tabulateResults(candles, stream.candleVotes);
      this.socket.emit('candleVoteUpdate', results);
    }
  }

  private getStream = async (streamId: string) : Promise<IStream | null | undefined> => {

    const mongoClient: mongodb.MongoClient = await new Promise((resolve: any) =>
      mongodb.MongoClient.connect(config.mongoDBConnectionString, (err, client) => { resolve(client); }));

    const db = mongoClient.db('iodb');

    let stream: IStream | null | undefined;

    if (db.collection('streams') !== undefined) {
      stream = await db.collection('streams').findOne({ streamId: streamId });
    }

    await mongoClient.close();

    return stream;
  }

  private getCandles = async () : Promise<ICandle[]>  => {

    const mongoClient: mongodb.MongoClient = await new Promise((resolve: any) =>
    mongodb.MongoClient.connect(config.mongoDBConnectionString, (err: any, client: mongodb.MongoClient) => { resolve(client); }));

    const db = mongoClient.db('iodb');

    const candles: ICandle[] = await new Promise((resolve: any) =>
      db.collection('candles').find({}).toArray((err: any, res: any) => {
      if (err) {
        resolve(null);
      }
      resolve(res);
    }));

    await mongoClient.close();

    return candles;
  }

  private updateStream = async (streamId: string, payload: any) => {
    const mongoClient: mongodb.MongoClient = await new Promise((resolve: any) =>
      mongodb.MongoClient.connect(config.mongoDBConnectionString, (err, client) => { resolve(client); }));

    const db = mongoClient.db('iodb');

    await db.collection('streams').updateOne({ streamId: streamId }, payload);

    await mongoClient.close();
  }
}

const tabulateResults = (candles: ICandle[], votes: ICandleVote[]) : ICandleVoteResult[] => {
  const voteResults: any = _.groupBy(votes, 'candleName');

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

