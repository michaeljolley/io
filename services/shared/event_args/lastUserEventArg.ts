import { IUserInfo } from "../models";
import { IBaseEventArg } from "./baseEventArg";

export interface ILastUserEventArg extends IBaseEventArg {
  userInfo: IUserInfo;
}
