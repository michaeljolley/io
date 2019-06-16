import { ChatUserstate } from "tmi.js";

export function projectCommand(message: string, activeStream: any | undefined, user: ChatUserstate, twitchChatFunc: Function) {

  if (message === undefined || message.length === 0 || user === undefined || twitchChatFunc === undefined) {
    return false;
  }

  const splitMessage = message.trim().split(' ');

  if (splitMessage[0].toLocaleLowerCase() !== '!project') {
    return false;
  }

  if (activeStream === undefined ||
    activeStream.started_at === undefined ) {
      twitchChatFunc(`We're not streaming at the moment, so no project to speak of.`);
      return true;
  }

  if (activeStream.title !== undefined) {
    twitchChatFunc(`Today's project: ${activeStream.title}`);
  }

  return true;
}
