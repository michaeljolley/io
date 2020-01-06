import { IBaseEventArg } from './baseEventArg';
import { IUserInfo } from '../models/index';

export interface IUserEventArg extends IBaseEventArg {
  streamDate: string;
  user: IUserInfo;
}
