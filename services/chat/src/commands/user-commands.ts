import { ChatUserstate } from 'tmi.js';

import { get } from '@shared/common';
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

  if (firstWord !== '!profile' ||
     params.length <= 2) {
    return false;
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
