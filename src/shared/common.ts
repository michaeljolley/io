import * as restler from 'restler';
import * as dotenv from 'dotenv';

dotenv.config();

import * as config from './config';

export { config };

export const isMod = (user: any) : boolean => {
  if (user &&
      user.badges &&
      user.badges.moderator) {
        return true;
      }
  return false;
};

export const isBroadcaster = (user: any) : boolean => {
  if (user &&
      user.badges &&
      user.badges.broadcaster) {
        return true;
      }
  return false;
};

export const log = (level: string, message: string) => {
  const captains: any = console;
  const { hours, minutes } = getTime();
  captains[level](`[${hours}:${minutes}] ${message}`);
};

export const dir = (message: string, obj: any) => {
  const captains: any = console;
  captains.dir(message, obj);
};

export const getTime = () => {
  const date = new Date();
  const rawMinutes = date.getMinutes();
  const rawHours = date.getHours();
  const hours = (rawHours < 10 ? '0' : '') + rawHours.toLocaleString();
  const minutes = (rawMinutes < 10 ? '0' : '') + rawMinutes.toLocaleString();
  return { hours, minutes };
};

export const get = (url: string, ...headerParams: Array<{ [key: string]: string }>) => {
  const headers: {[key:string]: string} = {
    "Authorization": `Bearer ${config.twitchClientToken}`,
    "Content-Type": "application/json",
    "Client-ID": config.twitchClientId
  };
  // Add or replace existing headers.
  if (headerParams.length > 0) {
    headerParams.map(param => {
      Object.keys(param).forEach(paramKey => {
        for (const headerKey in headers) {
          if (headerKey.toLocaleLowerCase() === paramKey.toLocaleLowerCase()) {
            headers[headerKey] = param[paramKey];
            return;
          }
        }
        headers[paramKey] = param[paramKey];
      });
    });
  }
  return new Promise((resolve, reject) => {
      restler.get(url, {
          headers
      }).on("complete", (data: any) => {
          resolve(data);
      });
  });
};
