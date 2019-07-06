const {
  MONGO_DB_CONN_STRING,
  MONGO_DB_DATABASE,
  MONGO_DB_PASSWORD,
  MONGO_DB_USER,
  TWITCH_CLIENT_ID,
  TWITCH_CLIENT_TOKEN,
  TWITCH_CLIENT_USERNAME,
  TWITCH_CLIENT_USER_ID,
  TWITCH_BOT_USERNAME,
  TWITCH_BOT_TOKEN
} = process.env;

const requireConfigMessage = 'REQUIRED CONFIGURATION WAS NOT PROVIDED';

export const mongoDBConnectionString: string =
  MONGO_DB_CONN_STRING || requireConfigMessage;

export const mongoDBDatabase: string =
  MONGO_DB_DATABASE || requireConfigMessage;

export const mongoDBUser: string =
  MONGO_DB_USER || requireConfigMessage;

export const mongoDBPassword: string =
  MONGO_DB_PASSWORD || requireConfigMessage;

export const twitchClientId: string =
  TWITCH_CLIENT_ID || requireConfigMessage;

export const twitchClientToken: string =
  TWITCH_CLIENT_TOKEN || requireConfigMessage;

export const twitchClientUsername: string =
  TWITCH_CLIENT_USERNAME || 'themichaeljolley';

export const twitchClientUserId: string =
  TWITCH_CLIENT_USER_ID || '279965339';

export const twitchBotUsername: string =
  TWITCH_BOT_USERNAME || 'b3_bot';

export const twitchBotToken: string =
  TWITCH_BOT_TOKEN || requireConfigMessage;
