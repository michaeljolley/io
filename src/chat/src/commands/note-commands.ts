import { IStream, IUserInfo, IStreamNote } from '../models';
import { ChatUserstate } from 'tmi.js';
import { IBaseEventArg, INewNoteEventArg } from '../event_args/index';
import { isBroadcaster, isMod } from '../common';

export const noteCommand = async (
  message: string,
  user: ChatUserstate,
  userInfo: IUserInfo,
  activeStream: IStream | undefined,
  getUserFunc: (username: string) => Promise<IUserInfo>,
  twitchChatFunc: (message: string) => void,
  emitMessageFunc: (event: string, payload: IBaseEventArg) => void
): Promise<boolean> => {

  if (
    message === undefined ||
    userInfo === undefined ||
    activeStream === undefined ||
    message.length === 0 ||
    message.split(' ').length < 3 ||
    emitMessageFunc === undefined ||
    (isBroadcaster(user) === false && isMod(user))
  ) {
    return false;
  }

  const lowerMessage = message.toLocaleLowerCase().trim();
  const firstWord = lowerMessage.split(' ')[0];
  const contributorUsername = lowerMessage.split(' ')[1];
  const note: string = lowerMessage.slice(6 + contributorUsername.length + 1);

  if (firstWord !== '!note') {
    return false;
  }

  const helpingUser: IUserInfo = await getUserFunc(contributorUsername.replace('@', ''));

  if (helpingUser === undefined) {
    twitchChatFunc(`Yo ${userInfo.login}! I can't find a user named ${contributorUsername}`);
    return true;
  }

  const newNote: IStreamNote = {
    name: note,
    user: helpingUser
  };

  const newNoteEvent: INewNoteEventArg = {
    streamId: activeStream.id,
    streamNote: newNote
  };

  const helperName: string = helpingUser.display_name || helpingUser.login;

  twitchChatFunc(`Thanks for helping ${helperName}! After we finish today you'll see your name in our stream notes at https://baldbeardedbuilder.com`);

  emitMessageFunc('newNote', newNoteEvent);

  return true;
};
