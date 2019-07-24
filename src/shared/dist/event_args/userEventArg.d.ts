import { IBaseEventArg } from "./baseEventArg";
import { IUserInfo } from "../models/index";
export interface IUserEventArg extends IBaseEventArg {
    streamId: string;
    user: IUserInfo;
}
