import moment = require('moment');

export const uptimeCommand = (
  message: string,
  activeStream: any | undefined,
  twitchChatFunc: Function
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
