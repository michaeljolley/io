import { IUserInfo, ICandle } from '.';

export interface IVote {
  streamDate: string;
  user: IUserInfo;
  candle: ICandle;
}
