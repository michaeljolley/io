import * as restler from 'restler';
import * as dotenv from 'dotenv';

dotenv.config();

import * as config from './config';

export { config };

export const log = (level: string, message: string) => {
  const captains: any = console;
  captains[level](message);
};

export const dir = (message: string, obj: any) => {
  const captains: any = console;
  captains.dir(message, obj);
};

export const get = (url: string) => {
  return new Promise((resolve, reject) => {
      restler.get(url, {
          headers: {
              "Client-ID": config.twitchClientId,
              "Content-Type": "application/json"
          }
      }).on("complete", (data: any) => {
          resolve(data);
      });
  });
}
