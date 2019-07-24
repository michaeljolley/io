import { ISubscriber } from "../models";
import { IBaseEventArg } from "./baseEventArg";
export interface INewSubscriptionEventArg extends IBaseEventArg {
    streamId: string;
    subscriber: ISubscriber;
}
