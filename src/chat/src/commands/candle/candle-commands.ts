import mongodb = require('mongodb');
import * as _ from 'lodash';
import { ChatUserstate } from 'tmi.js';
import { ICandle, IStream, ICandleVote } from '../../models';
import { config, isBroadcaster, isMod, log } from '../../common';

let secondsToVote: number = 60;
let voteActive: boolean = false;
let voteTimeout: any;

export const candleCommand = async (
  message: string,
  user: ChatUserstate,
  activeStream: IStream | undefined,
  twitchChatFunc: Function,
  emitMessageFunc: Function
) => {
  if (
    message === undefined ||
    message.length === 0 ||
    user === undefined ||
    twitchChatFunc === undefined
  ) {
    return false;
  }
  const splitMessage = message.trim().split(' ');

  if (splitMessage[0].toLocaleLowerCase() !== '!candle') {
    return false;
  }

  if (activeStream === undefined ||
    activeStream.started_at === undefined) {
    twitchChatFunc(
      `We're not streaming right now so I'm not keeping track of the candle @theMichaelJolley is burning.`
    );
    return true;
  }

  // base !candle command
  if (splitMessage.length === 1) {
    await baseCandleCommand(activeStream, twitchChatFunc);
  }
  else {

    // Only accessible by mods or the broadcaster
    if (isMod(user) || isBroadcaster(user)) {
      if (splitMessage[1].toLocaleLowerCase() === 'start' && voteActive === false) {
        await startCandleVoteCommand(splitMessage, activeStream, twitchChatFunc, emitMessageFunc);
      }

      if (splitMessage[1].toLocaleLowerCase() === 'stop' && voteActive === true) {
        await stopCandleVoteCommand(activeStream, twitchChatFunc, emitMessageFunc);
      }

      if (splitMessage[1].toLocaleLowerCase() === 'reset') {
        await resetCandleVoteCommand(activeStream, twitchChatFunc, emitMessageFunc);
      }
    }

    const commandArray: string[] = ['start', 'stop', 'reset'];
    if (commandArray.indexOf(splitMessage[1].toLocaleLowerCase()) === -1 && voteActive === true) {
      await candleVoteCommand(splitMessage, user, activeStream, twitchChatFunc, emitMessageFunc);
    }
  }

  return true;
};

const baseCandleCommand = async (
  activeStream: IStream,
  twitchChatFunc: Function) => {

    const stream: IStream | null | undefined = await getStream(activeStream.streamId);

    if (stream == null ||
      stream.candle == null) {
        if (voteActive) {
          twitchChatFunc(
            `It's still up in the air. Voting is active now.`
          );
        }
        else {
          twitchChatFunc(
            `I dunno, but it smells like stinky feet in here. Maybe we should vote for a candle @theMichaelJolley.`
          );
        }
    }
    else {
      twitchChatFunc(
        `We're burning ${stream.candle.label}. Try it yourself at ${stream.candle.url}`
      );
    }
};

const startCandleVoteCommand = async (
  splitMessage: string[],
  activeStream: IStream,
  twitchChatFunc: Function,
  emitMessageFunc: Function) => {

  if (splitMessage.length === 3 && isNaN(parseInt(splitMessage[2], undefined)) === false) {
    secondsToVote = parseInt(splitMessage[2], undefined);
  }

  const candles: ICandle[] = await getCandles();

  if (secondsToVote > 0 && candles != null && candles.length > 0) {

    await resetCandleVoteCommand(activeStream, twitchChatFunc, emitMessageFunc);

    const availableCandles: string = candles.map((f: any) => f.name).join(', ');

    voteActive = true;
    voteTimeout = setTimeout(() => {
        stopCandleVoteCommand(activeStream, twitchChatFunc, emitMessageFunc);
      }, secondsToVote * 1000);

    twitchChatFunc(`Voting is open for our Candle to Code By. Send !candle {candle name} to vote.  Available choices are: ${availableCandles}`);
    log('info', `Vote for candle started`);
  }
};

const stopCandleVoteCommand = async (
  activeStream: IStream,
  twitchChatFunc: Function,
  emitMessageFunc: Function) => {

    voteActive = false;
    voteTimeout = undefined;

    emitMessageFunc('candleStop', activeStream.streamId);
    log('info', `Vote for candle stopped`);
};

const resetCandleVoteCommand = async (
  activeStream: IStream,
  twitchChatFunc: Function,
  emitMessageFunc: Function) => {

    voteActive = false;
    if (voteTimeout !== undefined) {
      voteTimeout = undefined;
    }

    emitMessageFunc('candleReset', activeStream.streamId);
    return;
};

const candleVoteCommand = async (
  splitMessage: string[],
  user: ChatUserstate,
  activeStream: IStream,
  twitchChatFunc: Function,
  emitMessageFunc: Function) => {

    const userDisplayName: string | undefined = user["display-name"] ? user["display-name"] : user.username;

    const candles: ICandle[] = await getCandles();

    if (candles != null && candles.length > 0) {

      const userCandleChoice: string = splitMessage[1].toLocaleLowerCase();

      const vote: ICandle | undefined = candles.find((f: ICandle) => f.name === userCandleChoice);

      if (vote === undefined) {
        const availableCandles: string = candles.map((f: any) => f.name).join(', ');
        twitchChatFunc(`@${userDisplayName}, ${splitMessage[1]} isn't a valid choice. Acceptable choices are: ${availableCandles}`);
        return;
      }

      if (user.username) {
        const userVote: ICandleVote = { candleName: vote.name, username: user.username };
        emitMessageFunc('candleVote', activeStream.streamId, userVote);
        log('info', `Vote for ${userDisplayName}: ${userVote.candleName}`);
      }
    }
};


const getStream = async (streamId: string) : Promise<IStream | null | undefined>  => {

  const mongoClient: mongodb.MongoClient = await new Promise((resolve: any) =>
    mongodb.MongoClient.connect(config.mongoDBConnectionString, (err: any, client: mongodb.MongoClient) => { resolve(client); }));

  const db = mongoClient.db('iodb');

  let stream: IStream | null | undefined;

  if (db.collection('streams') !== undefined) {
    stream = await db.collection('streams').findOne({ streamId });
  }

  await mongoClient.close();

  return stream;
};

const getCandles = async () : Promise<ICandle[]>  => {

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
};
