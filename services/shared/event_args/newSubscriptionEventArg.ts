import { ISubscriber } from '../models';
import { IBaseEventArg } from './baseEventArg';

export interface INewSubscriptionEventArg extends IBaseEventArg {
  streamDate: string;
  subscriber: ISubscriber;
}
