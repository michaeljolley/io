import { ChatUserstate } from 'tmi.js';

import { IUserInfo, IProjectSettings } from '@shared/models';
import { IBaseEventArg } from '@shared/event_args/index';
import { isBroadcaster, isMod } from '@shared/common';

export const repoCommand = (
  message: string,
  user: ChatUserstate,
  userInfo: IUserInfo,
  projectSettings: IProjectSettings,
  twitchChatFunc: (message: string) => void,
  emitMessageFunc: (event: string, payload: IBaseEventArg) => void
): IProjectSettings | boolean => {

  if (
    message === undefined ||
    message.length === 0    
  ) {
    return false;
  }

  const lowerMessage = message.toLocaleLowerCase().trim();
  const args = message.split(' ');
  const firstWord = lowerMessage.split(' ')[0];

  if (firstWord !== '!repo') {
    return false;
  }  
  
  if (!isMod(user) || !isBroadcaster(user)) {
    return true;
  }


  if (projectSettings) {
    projectSettings.repo = args[1];
  }

  
  if (twitchChatFunc) {
    twitchChatFunc(
      `Updated project settings. We are currently working on ${projectSettings.repo}`
    );
  }

  return projectSettings ? projectSettings : true;
};

export const issueCommand = (
  message: string,
  user: ChatUserstate,
  userInfo: IUserInfo,
  projectSettings: IProjectSettings,
  twitchChatFunc: (message: string) => void,
  emitMessageFunc: (event: string, payload: IBaseEventArg) => void
): IProjectSettings | boolean => {

  if (
    message === undefined ||
    message.length === 0    
  ) {
    return false;
  }

  const lowerMessage = message.toLocaleLowerCase().trim();
  const args = message.split(' ');
  const firstWord = lowerMessage.split(' ')[0];

  if (firstWord !== '!issue') {
    return false;
  }  
  
  if (!isMod(user) || !isBroadcaster(user) || args.length === 1) {
    return true;
  }


  if (projectSettings) {
    projectSettings.issue = +args[1];
  }

  
  if (twitchChatFunc && !isNaN(projectSettings.issue)) {
    twitchChatFunc(
      `Updated project settings. Currently working on issue # ${projectSettings.issue}`
    );
  }

  return projectSettings ? projectSettings : true;
};

export const contributeCommand = (
  message: string,
  user: ChatUserstate,
  userInfo: IUserInfo,
  projectSettings: IProjectSettings,
  twitchChatFunc: (message: string) => void,
  emitMessageFunc: (event: string, payload: IBaseEventArg) => void
): IProjectSettings | boolean => {

  if (
    message === undefined ||
    message.length === 0    
  ) {
    return false;
  }

  const lowerMessage = message.toLocaleLowerCase().trim();
  const args = message.split(' ');
  const firstWord = lowerMessage.split(' ')[0];

  if (firstWord !== '!contributor') {
    return false;
  }  
  
  if (!isMod(user) || !isBroadcaster(user) || args.length === 1) {
    return true;
  }

  if (args.length >= 3) {
    let comment = `@all-contributors please add @${args[1]} for `;
    let contributions = args.slice(2);

    comment = comment + contributions.join(',');

    
  }
  
  if (twitchChatFunc && !isNaN(projectSettings.issue)) {
    twitchChatFunc(
      `Updated project settings. Currently working on issue # ${projectSettings.issue}`
    );
  }

  return projectSettings ? projectSettings : true;
};