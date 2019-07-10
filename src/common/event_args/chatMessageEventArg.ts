import { Userstate } from 'tmi.js';
import { IUserInfo } from "../models";
import { IBaseEventArg } from "./baseEventArg";

export interface IChatMessageEventArg extends IBaseEventArg {
  message: string;
  user: Userstate;
  userInfo: IUserInfo
}
