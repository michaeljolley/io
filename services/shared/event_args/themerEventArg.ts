import { IBaseEventArg } from './baseEventArg';
import { IUserInfo } from '../models/index';

export interface IThemerEventArg extends IBaseEventArg {
  streamDate: string;
  user: IUserInfo;
}
