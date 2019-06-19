const {
  MONGO_DB_CONN_STRING
} = process.env;

const requireConfigMessage = 'REQUIRED CONFIGURATION WAS NOT PROVIDED';

export const mongoDBConnectionString: string =
  MONGO_DB_CONN_STRING || requireConfigMessage;

