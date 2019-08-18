import { IUserInfo } from "../models";
import { IBaseEventArg } from "./baseEventArg";

export interface IUserProfileUpdateEventArg extends IBaseEventArg {
  userInfo: IUserInfo;
}
