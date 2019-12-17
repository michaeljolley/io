import { IUserInfo, ICandle } from '../models';
import { IBaseEventArg } from './baseEventArg';

export interface ICandleVoteEventArg extends IBaseEventArg {
  candle: ICandle;
  streamDate: string;
  userInfo: IUserInfo;
}
