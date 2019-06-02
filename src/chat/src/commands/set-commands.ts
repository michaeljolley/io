import { ChatUserstate } from "tmi.js";

let currentCandle: string;
let currentProject: string;

export function candleCommand(message: string, user: ChatUserstate, twitchChatFunc: Function) {

  if (message === undefined || message.length === 0 || user === undefined || twitchChatFunc === undefined) {
    return false;
  }

  const splitMessage = message.trim().split(' ');

  if (splitMessage[0].toLocaleLowerCase() !== '!candle') {
    return false;
  }

  if (splitMessage.length === 1) {
    if (currentCandle === undefined) {
      twitchChatFunc(`I dunno. It smells like stinky feet. Maybe we should light a candle @theMichaelJolley.`);
    }
    else {
      twitchChatFunc(`We're burning ${currentCandle}. Check out the link in today's show notes to try it yourself!`);
    }
  }
  else if (user.mod === true ||
          (user.badges && user.badges.broadcaster)) {

    splitMessage.splice(0, 1);
    currentCandle = splitMessage.join(' ');
    twitchChatFunc(`We're burning ${currentCandle}. Check out the link in today's show notes to try it yourself!`);
  }

  return true;
}

export function projectCommand(message: string, user: ChatUserstate, twitchChatFunc: Function) {

  if (message === undefined || message.length === 0 || user === undefined || twitchChatFunc === undefined) {
    return false;
  }

  const splitMessage = message.trim().split(' ');

  if (splitMessage[0].toLocaleLowerCase() !== '!project') {
    return false;
  }

  if (splitMessage.length === 1) {
    if (currentProject === undefined) {
      twitchChatFunc(`I have no idea what this guy is working on. @theMichaelJolley, how about an update?`);
    }
    else {
      twitchChatFunc(`Today's project: ${currentProject}`);
    }
  }
  else if (user.mod === true ||
          (user.badges && user.badges.broadcaster)) {

    splitMessage.splice(0, 1);
    currentProject = splitMessage.join(' ');
    twitchChatFunc(`Today's project: ${currentProject}`);
  }

  return true;
}
