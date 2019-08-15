import { IBaseEventArg } from "./baseEventArg";
import { IUserInfo } from "../models/index";

export interface IMediaEventArg extends IBaseEventArg {
  clipName: string;
  streamId: string;
  user: IUserInfo;
}
