import { IBaseEventArg } from "./baseEventArg";
export interface IUserJoinedEventArg extends IBaseEventArg {
    username: string;
}
