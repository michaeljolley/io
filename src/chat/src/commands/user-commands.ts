import { ChatUserstate } from 'tmi.js';

import { get } from '@shared/common';

export const updateUserCommand = async (
    message: string,
    user: ChatUserstate,
    twitchChatFunc: (message: string) => void
  ): Promise<boolean> => {
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
              return true;
        } else {
            if (twitchChatFunc) {
                twitchChatFunc(
                  `There was an issue while updating ${user.username}`
                );
              }
              return true;
        }
    });
    
    return true;
  };