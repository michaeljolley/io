import { IUserInfo } from "../models";
import { IBaseEventArg } from "./baseEventArg";

export interface INewAnnouncementEventArg extends IBaseEventArg {
  user: IUserInfo;
  message: string;
}
