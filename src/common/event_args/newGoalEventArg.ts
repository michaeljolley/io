import { IStreamGoal } from "../models";
import { IBaseEventArg } from "./baseEventArg";

export interface INewGoalEventArg extends IBaseEventArg {
  streamId: string;
  streamGoal: IStreamGoal;
}
