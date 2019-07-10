import { IUserInfo } from "../models";
import { IBaseEventArg } from "./baseEventArg";

export interface INewFollowerEventArg extends IBaseEventArg {
  streamId: string;
  follower: IUserInfo;
}
