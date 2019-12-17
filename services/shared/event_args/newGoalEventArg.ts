import { IStreamGoal } from '../models';
import { IBaseEventArg } from './baseEventArg';

export interface INewGoalEventArg extends IBaseEventArg {
  streamDate: string;
  streamGoal: IStreamGoal;
}
