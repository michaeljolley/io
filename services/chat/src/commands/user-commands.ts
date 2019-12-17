import { ChatUserstate } from 'tmi.js';
import fs from 'fs';
import * as path from 'path';

import { genericComicAvatars, get } from '@shared/common';
import { IUserInfo } from '@shared/models';
import { IBaseEventArg, IUserProfileUpdateEventArg } from '@shared/event_args';
import { SocketIOEvents } from '@shared/events';

export const updateUserCommand = async (
    message: string,
    user: ChatUserstate,
    userInfo: IUserInfo,
    twitchChatFunc: (message: string) => void,
    emitMessageFunc: (event: string, payload: IBaseEventArg) => void
  ): Promise<IUserInfo | boolean> => {
    if (message === undefined || message.length === 0) {
      return false;
    }

    const lowerMessage = message.toLocaleLowerCase().trim();
    const firstWord = lowerMessage.split(' ')[0];

    if (firstWord !== '!update') {
      return false;
    }

    // Call the user service to update user
    const url = `http://user/update/${user.username}/true`;

    await get(url).then((updatedUser: any) => {
        if (updatedUser && updatedUser != undefined)
        {
            if (twitchChatFunc) {
                twitchChatFunc(
                  `User ${user.username} has been successfully updated`
                );
              }
              return updatedUser;
        } else {
            if (twitchChatFunc) {
                twitchChatFunc(
                  `There was an issue while updating ${user.username}`
                );
              }
        }
    });
    return true;
  };

export const profileCommand = async (
  message: string,
  user: ChatUserstate,
  userInfo: IUserInfo,
  twitchChatFunc: (message: string) => void,
  emitMessageFunc: (event: string, payload: IBaseEventArg) => void
): Promise<IUserInfo | boolean> => {
  if (message === undefined || message.length === 0) {
    return false;
  }

  const lowerMessage = message.toLocaleLowerCase().trim();
  const params = lowerMessage.split(' ');
  const firstWord = params[0];

  if (firstWord !== '!profile') {
    return false;
  }

  if (params.length === 1) {
    const username: string = userInfo.display_name || userInfo.login; 

    // The user only sent !profile so return what we have set for them.
    let message: string = `Hi @${username}, here's what we know:`;

    if (userInfo.twitterHandle) {
      message = `${message} Your Twitter handle is ${userInfo.twitterHandle}.`;
    }
    
    if (userInfo.githubHandle) {
      message = `${message} Your GitHub handle is ${userInfo.githubHandle}.`;
    }

    if (userInfo.twitterHandle === undefined &&
        userInfo.githubHandle === undefined) {
      message = `${message} Nothing.  We know nothing. What are you trying to hide?`;
    }

    twitchChatFunc(message);
  }

  const secondWord = params[1];

  if (secondWord !== 'twitter' &&
      secondWord !== 'github') {
    return false;
  }

  // Send an event to update your social profiles
  switch (secondWord) {
    case 'twitter':
      userInfo.twitterHandle = params[2];
      break;

    case 'github':
        userInfo.githubHandle = params[2];
      break;
  }

  const profileUpdateEventArg: IUserProfileUpdateEventArg = {
    userInfo
  };

  emitMessageFunc(SocketIOEvents.UserProfileUpdated, profileUpdateEventArg);

  return true;
};

export const avatarCommand = async (
  message: string,
  user: ChatUserstate,
  userInfo: IUserInfo,
  twitchChatFunc: (message: string) => void,
  emitMessageFunc: (event: string, payload: IBaseEventArg) => void
): Promise<IUserInfo | boolean> => {
  if (message === undefined || message.length === 0) {
    return false;
  }

const lowerMessage = message.toLocaleLowerCase().trim();
  const params = lowerMessage.split(' ');
  const firstWord = params[0];

  if (firstWord !== '!avatar' ||
     params.length < 2) {
    return false;
  } 

  const secondWord: string = params[1].toLocaleLowerCase();
  const genericAvatars: string[] = genericComicAvatars;

  if (secondWord === 'help') {
    let message: string = `You can change your comic chat avatar by sending "!avatar {character}".  Available character names are: `;

    message = `${message}${genericAvatars.join(', ')}`
    twitchChatFunc(message);
    return true;
  }

  let saveUser: boolean = false;

  if (genericAvatars.find(f => f === secondWord) !== undefined) {
    userInfo.comicAvatar = secondWord;
    saveUser = true;
  } else {
    if (secondWord === userInfo.login &&
        fs.existsSync(path.join(__dirname, '..', `/assets/images/characters/${secondWord}`))
      ) {
      userInfo.comicAvatar = secondWord;
      saveUser = true;
    }
  }

  if (saveUser) {
    const profileUpdateEventArg: IUserProfileUpdateEventArg = {
      userInfo
    };

    emitMessageFunc(SocketIOEvents.UserProfileUpdated, profileUpdateEventArg);
  }

  return true;
};
