import moment = require('moment');
import { ChatUserstate } from 'tmi.js';

import { SocketIOEvents } from '@shared/events';
import { IStream, IUserInfo, IStreamSegment, IStreamGoal } from '@shared/models';
import { INewSegmentEventArg, IBaseEventArg, INewGoalEventArg } from '@shared/event_args/index';
import { isBroadcaster } from '@shared/common';

export const uptimeCommand = (
  message: string,
  user: ChatUserstate,
  userInfo: IUserInfo,
  activeStream: IStream | undefined,
  twitchChatFunc: (message: string) => void,
  emitMessageFunc: (event: string, payload: IBaseEventArg) => void
): boolean => {

  if (
    message === undefined ||
    activeStream === undefined ||
    activeStream.started_at === undefined ||
    message.length === 0
  ) {
    return false;
  }

  const lowerMessage = message.toLocaleLowerCase().trim();
  const firstWord = lowerMessage.split(' ')[0];

  if (firstWord !== '!uptime') {
    return false;
  }

  const startDate = moment(activeStream.started_at);
  const duration = moment.duration(moment().diff(startDate));

  let response: string = '';

  if (duration.hours() !== 0) {
    response = `${duration.hours()} hours`;
  }
  if (duration.minutes() !== 0) {
    response = response + ((response.length === 0 ? '' : ' and ')) + `${duration.minutes()} minutes.  Will the madness never end!?!`;
  }

  if (twitchChatFunc) {
    twitchChatFunc(
      `We've been streaming for ${response}.`
    );
  }

  return true;
};

export const projectCommand = (
  message: string,
  user: ChatUserstate,
  userInfo: IUserInfo,
  activeStream: IStream | undefined,
  twitchChatFunc: (message: string) => void,
  emitMessageFunc: (event: string, payload: IBaseEventArg) => void
): boolean => {

  if (
    message === undefined ||
    activeStream === undefined ||
    activeStream.title === undefined ||
    message.length === 0
  ) {
    return false;
  }

  const lowerMessage = message.toLocaleLowerCase().trim();
  const firstWord = lowerMessage.split(' ')[0];

  if (firstWord !== '!project') {
    return false;
  }

  if (twitchChatFunc) {
    twitchChatFunc(
      `${activeStream.title}`
    );
  }

  return true;
};

export const segmentCommand = (
  message: string,
  user: ChatUserstate,
  userInfo: IUserInfo,
  activeStream: IStream | undefined,
  twitchChatFunc: (message: string) => void,
  emitMessageFunc: (event: string, payload: IBaseEventArg) => void
): boolean => {

  if (
    message === undefined ||
    userInfo === undefined ||
    activeStream === undefined ||
    message.length === 0 ||
    emitMessageFunc === undefined
  ) {
    return false;
  }

  const lowerMessage = message.toLocaleLowerCase().trim();
  const firstWord = lowerMessage.split(' ')[0];

  if (firstWord !== '!mark') {
    return false;
  }

  const newSegment: IStreamSegment = {
    timestamp: new Date().toISOString(),
    topic: message.slice(6),
    user: userInfo
  };

  const newSegmentEvent: INewSegmentEventArg = {
    streamId: activeStream.id,
    streamSegment: newSegment
  };

  emitMessageFunc(SocketIOEvents.NewSegment, newSegmentEvent);

  return true;
};

export const goalCommand = (
  message: string,
  user: ChatUserstate,
  userInfo: IUserInfo,
  activeStream: IStream | undefined,
  twitchChatFunc: (message: string) => void,
  emitMessageFunc: (event: string, payload: IBaseEventArg) => void
): boolean => {

  if (
    message === undefined ||
    userInfo === undefined ||
    activeStream === undefined ||
    message.length === 0 ||
    emitMessageFunc === undefined ||
    isBroadcaster(user) === false
  ) {
    return false;
  }

  const lowerMessage = message.toLocaleLowerCase().trim();
  const firstWord = lowerMessage.split(' ')[0];

  if (firstWord !== '!goal') {
    return false;
  }

  const newGoal: IStreamGoal = {
    accomplished: false,
    name: message.slice(6)
  };

  const newStreamGoalEvent: INewGoalEventArg = {
    streamGoal: newGoal,
    streamId: activeStream.id
  };

  emitMessageFunc(SocketIOEvents.NewGoal, newStreamGoalEvent);

  return true;
};
