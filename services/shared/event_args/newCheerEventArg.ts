import { ICheer } from '../models';
import { IBaseEventArg } from './baseEventArg';

export interface INewCheerEventArg extends IBaseEventArg {
  cheerer: ICheer;
  streamDate: string;
}
