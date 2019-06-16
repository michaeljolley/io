export const websiteCommand = (message: string, twitchChatFunc: Function) : boolean => {

  if (message === undefined || message.length === 0) {
    return false;
  }

  const lowerMessage = message.toLocaleLowerCase().trim();
  const firstWord = lowerMessage.split(' ')[0];

  if (firstWord !== '!website') {
    return false;
  }

  if (twitchChatFunc) {
    twitchChatFunc(`Our show notes & replays can be found at https://baldbeardedbuilder.com`);
    return true;
  }

  return false;
};

export const blogCommand = (message: string, twitchChatFunc: Function) : boolean => {

  if (message === undefined || message.length === 0) {
    return false;
  }

  const lowerMessage = message.toLocaleLowerCase().trim();
  const firstWord = lowerMessage.split(' ')[0];

  if (firstWord !== '!blog') {
    return false;
  }

  if (twitchChatFunc) {
    twitchChatFunc(`Mike's personal blog can be found at https://michaeljolley.com`);
    return true;
  }

  return false;
};

export const githubCommand = (message: string, twitchChatFunc: Function) : boolean => {

  if (message === undefined || message.length === 0) {
    return false;
  }

  const lowerMessage = message.toLocaleLowerCase().trim();
  const firstWord = lowerMessage.split(' ')[0];

  if (firstWord !== '!github') {
    return false;
  }

  if (twitchChatFunc) {
    twitchChatFunc(`Mike's GitHub account can be found at https://github.com/michaeljolley`);
    return true;
  }

  return false;
};

export const twitterCommand = (message: string, twitchChatFunc: Function) : boolean => {

  if (message === undefined || message.length === 0) {
    return false;
  }

  const lowerMessage = message.toLocaleLowerCase().trim();
  const firstWord = lowerMessage.split(' ')[0];

  if (firstWord !== '!twitter') {
    return false;
  }

  if (twitchChatFunc) {
    twitchChatFunc(`You can find Mike on Twitter at https://twitter.com/michaeljolley`);
    return true;
  }

  return false;
};

export const discordCommand = (message: string, twitchChatFunc: Function) : boolean => {

  if (message === undefined || message.length === 0) {
    return false;
  }

  const lowerMessage = message.toLocaleLowerCase().trim();
  const firstWord = lowerMessage.split(' ')[0];

  if (firstWord !== '!discord') {
    return false;
  }

  if (twitchChatFunc) {
    twitchChatFunc(`You can join our discord using this link: https://discord.gg/XSG7HJm`);
    return true;
  }

  return false;
};

export const heroinesCommand = (message: string, twitchChatFunc: Function) : boolean => {

  if (message === undefined || message.length === 0) {
    return false;
  }

  const lowerMessage = message.toLocaleLowerCase().trim();
  const firstWord = lowerMessage.split(' ')[0];

  if (firstWord !== '!heroines') {
    return false;
  }

  if (twitchChatFunc) {
    twitchChatFunc(`The Heroines of JavaScript cards are created by Vue Vixens and support their scholarship fund. You can learn more at https://github.com/mtheoryx/heroines-of-javascript and https://vuevixens.org`);
    return true;
  }

  return false;
};

export const shoutoutCommand = (message: string, twitchChatFunc: Function) : boolean => {

  if (message === undefined || message.length === 0) {
    return false;
  }

  const lowerMessage = message.toLocaleLowerCase().trim();
  const splitMessage = lowerMessage.split(' ');

  if (splitMessage[0] !== '!so' || splitMessage.length < 2) {
    return false;
  }

  const username = splitMessage[1].replace('@', '');

  if (twitchChatFunc) {
    twitchChatFunc(`Shout out to @${username}!  Check out their stream at https://twitch.tv/${username} and give them a follow.`);
    return true;
  }

  return false;
};

export const helpCommand = (message: string, twitchChatFunc: Function) : boolean => {

  if (message === undefined || message.length === 0) {
    return false;
  }

  const lowerMessage = message.toLocaleLowerCase().trim();
  const firstWord = lowerMessage.split(' ')[0];

  if (firstWord !== '!help' && firstWord !== '!commands') {
    return false;
  }

  if (twitchChatFunc) {
    twitchChatFunc(`I can respond to the following commands: !blog, !candle, !discord, !github, !project, !so {user name}, !twitter, !website, !youtube`);
    return true;
  }

  return false;
};

export const youTubeCommand = (message: string, twitchChatFunc: Function) : boolean => {

  if (message === undefined || message.length === 0) {
    return false;
  }

  const lowerMessage = message.toLocaleLowerCase().trim();
  const firstWord = lowerMessage.split(' ')[0];

  if (firstWord !== '!youtube') {
    return false;
  }

  if (twitchChatFunc) {
    twitchChatFunc(`You can catch all our streams on YouTube at https://www.youtube.com/channel/UCn2FoDbv_veJB_UbrF93_jw`);
    return true;
  }

  return false;
};
