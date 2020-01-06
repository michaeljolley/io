import * as _ from 'lodash';
import { ChatUserstate } from 'tmi.js';

import { SocketIOEvents } from '@shared/events';
import { CandleDb, StreamDb } from '@shared/db';
import { ICandle, IStream, IUserInfo } from '@shared/models';
import { isBroadcaster, isMod, log } from '@shared/common';
import {
  ICandleVoteEventArg,
  IStreamEventArg,
  IBaseEventArg
} from '@shared/event_args';

let secondsToVote: number = 60;
let voteActive: boolean = false;
let voteTimeout: any;

export const candleCommand = async (
  message: string,
  user: ChatUserstate,
  userInfo: IUserInfo,
  activeStream: IStream | undefined,
  twitchChatFunc: (message: string) => void,
  emitMessageFunc: (event: string, payload: IBaseEventArg) => void
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

  const candleCommands: string[] = ['!candle', '!vote'];
  if (candleCommands.indexOf(splitMessage[0].toLocaleLowerCase()) === -1) {
    return false;
  }

  if (activeStream === undefined || activeStream.started_at === undefined) {
    twitchChatFunc(
      `We're not streaming right now so I'm not keeping track of the candle @BaldBeardedBuilder is burning.`
    );
    return true;
  }

  if (splitMessage[0].toLocaleLowerCase() === '!vote' && voteActive === false) {
    twitchChatFunc(`Candle voting is not active right now.`);
    return true;
  }

  // base !candle command
  if (splitMessage.length === 1) {
    const streamDb: StreamDb = new StreamDb();
    await baseCandleCommand(activeStream, streamDb, twitchChatFunc);
  } else {
    const candleDb: CandleDb = new CandleDb();

    // Only accessible by mods or the broadcaster
    if (isMod(user) || isBroadcaster(user)) {
      if (
        splitMessage[1].toLocaleLowerCase() === 'start' &&
        voteActive === false
      ) {
        await startCandleVoteCommand(
          splitMessage,
          activeStream,
          candleDb,
          twitchChatFunc,
          emitMessageFunc
        );
      }

      if (
        splitMessage[1].toLocaleLowerCase() === 'stop' &&
        voteActive === true
      ) {
        await stopCandleVoteCommand(activeStream, emitMessageFunc);
      }

      if (splitMessage[1].toLocaleLowerCase() === 'reset') {
        await resetCandleVoteCommand(activeStream, emitMessageFunc);
      }
    }

    const commandArray: string[] = ['start', 'stop', 'reset'];
    if (
      commandArray.indexOf(splitMessage[1].toLocaleLowerCase()) === -1 &&
      voteActive === true
    ) {
      await candleVoteCommand(
        splitMessage,
        user,
        userInfo,
        activeStream,
        candleDb,
        twitchChatFunc,
        emitMessageFunc
      );
    }
  }

  return true;
};

const baseCandleCommand = async (
  activeStream: IStream,
  streamDb: StreamDb,
  twitchChatFunc: (message: string) => void
) => {
  const stream: IStream | null | undefined = await streamDb.getStream(
    activeStream.streamDate
  );

  if (stream == null || stream.candle == null) {
    if (voteActive) {
      twitchChatFunc(`It's still up in the air. Voting is active now.`);
    } else {
      twitchChatFunc(
        `I dunno, but it smells like stinky feet in here. Maybe we should vote for a candle @BaldBeardedBuilder.`
      );
    }
  } else {
    twitchChatFunc(
      `We're burning ${stream.candle.label}. Try it yourself at ${stream.candle.url}`
    );
  }
};

const startCandleVoteCommand = async (
  splitMessage: string[],
  activeStream: IStream,
  candleDb: CandleDb,
  twitchChatFunc: (message: string) => void,
  emitMessageFunc: (event: string, payload: IBaseEventArg) => void
) => {
  if (
    splitMessage.length === 3 &&
    isNaN(parseInt(splitMessage[2], undefined)) === false
  ) {
    secondsToVote = parseInt(splitMessage[2], undefined);
  }

  const candles: ICandle[] = await candleDb.getCandles();

  if (secondsToVote > 0 && candles != null && candles.length > 0) {
    await resetCandleVoteCommand(activeStream, emitMessageFunc);

    const availableCandles: string = candles.map((f: any) => f.name).join(', ');

    voteActive = true;
    voteTimeout = setTimeout(() => {
      stopCandleVoteCommand(activeStream, emitMessageFunc);
    }, secondsToVote * 1000);

    twitchChatFunc(
      `Voting is open for our Candle to Code By. Send [!candle|!vote] {candle name} to vote.  Available choices are: ${availableCandles}`
    );
    log('info', `Vote for candle started`);
  }
};

const stopCandleVoteCommand = async (
  activeStream: IStream,
  emitMessageFunc: Function
) => {
  voteActive = false;
  voteTimeout = undefined;

  const streamEventArg: IStreamEventArg = {
    stream: activeStream
  };

  emitMessageFunc(SocketIOEvents.CandleVoteStop, streamEventArg);
  log('info', `Vote for candle stopped`);
};

const resetCandleVoteCommand = async (
  activeStream: IStream,
  emitMessageFunc: Function
) => {
  voteActive = false;
  if (voteTimeout !== undefined) {
    voteTimeout = undefined;
  }

  const streamEventArg: IStreamEventArg = {
    stream: activeStream
  };

  emitMessageFunc(SocketIOEvents.CandleReset, streamEventArg);
  return;
};

const candleVoteCommand = async (
  splitMessage: string[],
  user: ChatUserstate,
  userInfo: IUserInfo,
  activeStream: IStream,
  candleDb: CandleDb,
  twitchChatFunc: (message: string) => void,
  emitMessageFunc: (event: string, payload: IBaseEventArg) => void
) => {
  const userDisplayName: string | undefined = user['display-name']
    ? user['display-name']
    : user.username;

  const candles: ICandle[] = await candleDb.getCandles();

  if (candles != null && candles.length > 0) {
    const userCandleChoice: string = splitMessage[1].toLocaleLowerCase();

    const candleVote: ICandle | undefined = candles.find(
      (f: ICandle) => f.name === userCandleChoice
    );

    if (candleVote === undefined) {
      const availableCandles: string = candles
        .map((f: any) => f.name)
        .join(', ');
      twitchChatFunc(
        `@${userDisplayName}, ${splitMessage[1]} isn't a valid choice. Acceptable choices are: ${availableCandles}`
      );
      return;
    }

    const candleVoteEventArg: ICandleVoteEventArg = {
      candle: candleVote,
      streamDate: activeStream.streamDate,
      userInfo
    };
    emitMessageFunc(SocketIOEvents.CandleVote, candleVoteEventArg);
    log('info', `Vote for ${userDisplayName}: ${candleVote.label}`);
  }
};
