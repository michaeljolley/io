import * as dotenv from 'dotenv';

dotenv.config();

import * as config from './config';

export { config };

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
