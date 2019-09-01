import { Userstate } from 'tmi.js';
import { IUserInfo } from "../models";
import { IBaseEventArg } from "./baseEventArg";

export interface IChatMessageEventArg extends IBaseEventArg {
  mentions: IUserInfo[];
  message: string;
  originalMessage: string;
  streamId: string;
  user: Userstate;
  userInfo: IUserInfo;
}
