import mongodb = require('mongodb');
import * as _ from 'lodash';
import { ChatUserstate } from 'tmi.js';
import { config, isBroadcaster, isMod, log } from '../../common';

let secondsToVote: number = 60;
let voteActive: boolean = false;
let voteTimeout: any;

export const candleCommand = async (
  message: string,
  user: ChatUserstate,
  activeStream: any | undefined,
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
  activeStream: any,
  twitchChatFunc: Function) => {

    const mongoClient: mongodb.MongoClient = await new Promise((resolve: any) =>
      mongodb.MongoClient.connect(config.mongoDBConnectionString, (err: any, client: mongodb.MongoClient) => { resolve(client); }));

    const db = mongoClient.db('iodb');

    const streamCandle: any = await db.collection('streamCandles').findOne({ streamId: activeStream.id });

    await mongoClient.close();

    log('info',`candles: ${JSON.stringify(streamCandle)}`);

    if (streamCandle == null ||
      streamCandle.length === 0) {
      twitchChatFunc(
        `I dunno, but it smells like stinky feet in here. Maybe we should vote for a candle @theMichaelJolley.`
      );
    }
    else {
      twitchChatFunc(
        `We're burning ${streamCandle.candle.label}. Try it yourself at ${streamCandle.candle.url}`
      );
    }
};

const startCandleVoteCommand = async (
  splitMessage: string[],
  activeStream: any,
  twitchChatFunc: Function,
  emitMessageFunc: Function) => {

  if (splitMessage.length === 3 && isNaN(parseInt(splitMessage[2], undefined)) === false) {
    secondsToVote = parseInt(splitMessage[2], undefined);
  }

  const mongoClient: mongodb.MongoClient = await new Promise((resolve: any) =>
    mongodb.MongoClient.connect(config.mongoDBConnectionString, (err: any, client: mongodb.MongoClient) => { resolve(client); }));

  const db = mongoClient.db('iodb');

  const candles: any = await new Promise((resolve: any) =>
    db.collection('candles').find({}).toArray((err: any, res: any) => {
    if (err) {
      resolve(null);
    }
    resolve(res);
  }));

  await mongoClient.close();

  if (secondsToVote > 0 && candles != null && candles.length > 0) {

    await resetCandleVoteCommand(activeStream, twitchChatFunc, emitMessageFunc);

    const availableCandles: string = candles.map((f: any) => f.name).join(', ');

    voteActive = true;
    voteTimeout = setTimeout(() => {
        stopCandleVoteCommand(activeStream, twitchChatFunc, emitMessageFunc);
      }, secondsToVote * 1000);

    twitchChatFunc(`Voting is open for our Candle to Code By. Send !vote {candle name} to vote.  Available choices are: ${availableCandles}`);
    emitMessageFunc('voteStart');
    log('info', `Vote for candle started`);
  }
};

const stopCandleVoteCommand = async (
  activeStream: any,
  twitchChatFunc: Function,
  emitMessageFunc: Function) => {

    voteActive = false;
    voteTimeout = undefined;

    const mongoClient: mongodb.MongoClient = await new Promise((resolve: any) =>
      mongodb.MongoClient.connect(config.mongoDBConnectionString, (err: any, client: mongodb.MongoClient) => { resolve(client); }));

    const db = mongoClient.db('iodb');

    const candles: any = await new Promise((resolve: any) =>
      db.collection('candles').find({}).toArray((err: any, res: any) => {
      if (err) {
        resolve(null);
      }
      resolve(res);
    }));

    const votes: any =  await new Promise((resolve: any) =>
      db.collection('candleVotes').find({ streamId: activeStream.id }).toArray((err: any, res: any) => {
        if (err) {
          resolve(null);
        }
        resolve(res);
      }));

    if (votes != null && votes.length > 0) {
      const results = tabulateResults(candles, votes);
      log('info', JSON.stringify(results));

      const winner = results.reduce((l: any, e: any) => {
        return e.votes > l.votes ? e : l;
      });

      const streamCandle: any = { streamId: activeStream.id, candle: winner.candle };
      await db.collection('streamCandles').insertOne(streamCandle);

      twitchChatFunc(`The vote is over and today's Candle to Code By is ${streamCandle.candle.label}.  You can try it yourself at ${streamCandle.candle.url}`);
    }

    await mongoClient.close();

    emitMessageFunc('voteStop');
    log('info', `Vote for candle stopped`);
};

const resetCandleVoteCommand = async (
  activeStream: any,
  twitchChatFunc: Function,
  emitMessageFunc: Function) => {

    voteActive = false;
    if (voteTimeout !== undefined) {
      voteTimeout = undefined;
    }

    const mongoClient: mongodb.MongoClient = await new Promise((resolve: any) =>
      mongodb.MongoClient.connect(config.mongoDBConnectionString, (err: any, client: mongodb.MongoClient) => { resolve(client); }));

    const db = mongoClient.db('iodb');

    await db.collection('streamCandles').deleteOne({ streamId: activeStream.id });
    await db.collection('candleVotes').deleteMany({ streamId: activeStream.id });

    await mongoClient.close();

    twitchChatFunc(`The vote for today's Candle to Code By has been reset.`);

    return;
};

const candleVoteCommand = async (
  splitMessage: string[],
  user: ChatUserstate,
  activeStream: any,
  twitchChatFunc: Function,
  emitMessageFunc: Function) => {

    const userDisplayName: string | undefined = user["display-name"] ? user["display-name"] : user.username;

    const mongoClient: mongodb.MongoClient = await new Promise((resolve: any) =>
      mongodb.MongoClient.connect(config.mongoDBConnectionString, (err: any, client: mongodb.MongoClient) => { resolve(client); }));

    const db = mongoClient.db('iodb');

    const candles: any = await new Promise((resolve: any) =>
      db.collection('candles').find({}).toArray((err: any, res: any) => {
      if (err) {
        resolve(null);
      }
      resolve(res);
    }));

    let votes: any =  await new Promise((resolve: any) =>
      db.collection('candleVotes').find({ streamId: activeStream.id }).toArray((err: any, res: any) => {
        if (err) {
          resolve(null);
        }
        resolve(res);
      }));

    if (candles != null && candles.length > 0) {

      const userCandleChoice: string = splitMessage[1].toLocaleLowerCase();

      const vote = candles.find((f: any) => f.name === userCandleChoice);

      if (vote == null) {
        twitchChatFunc(`@${userDisplayName}, ${splitMessage[1]} isn't a valid choice. Acceptable choices are: ${candles.join((f: any) => f.name, ', ')}`);
        return;
      }

      let existingVote: any | undefined;

      if (votes != null && votes.length > 0) {
        existingVote = votes.find((f: any) => f.user.username === user.username);
      }

      if (existingVote == null) {

        const userVote: any = { streamId: activeStream.id, user, candle: vote };
        await db.collection('candleVotes').insertOne(userVote);

        votes =  await new Promise((resolve: any) =>
          db.collection('candleVotes').find({ streamId: activeStream.id }).toArray((err: any, res: any) => {
            if (err) {
              resolve(null);
            }
            resolve(res);
          }));

        const results = tabulateResults(candles, votes);

        log('info', `Vote for ${userDisplayName}: ${userVote.candle.label}`);

        emitMessageFunc('voteUpdate', JSON.stringify(results));
      }
    }

    await mongoClient.close();
};

const tabulateResults : any = (candles: any, votes: any) => {
  const voteResults: any = _.groupBy(votes, 'candle.name');

  const results: any = [];

  for (const key of Object.keys(voteResults)) {
    const candle = candles.find((f: any) => f.name === key);
    results.push({candle, votes: voteResults[key].length});
  }

  log('info', `tabulateResults: ${JSON.stringify(results)}`);
  return results;
};
