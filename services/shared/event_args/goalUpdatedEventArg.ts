import { IStreamGoal } from '../models';
import { IBaseEventArg } from './baseEventArg';

export interface IGoalUpdatedEventArg extends IBaseEventArg {
  streamDate: string;
  streamGoal: IStreamGoal;
  type: string;
}
