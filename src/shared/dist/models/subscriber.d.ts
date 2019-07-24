import mongoose from "mongoose";
import { IUserInfo } from "./user-info";
export interface ISubscriber {
    user: IUserInfo;
    wasGift: boolean;
    cumulativeMonths: number;
}
export declare const SubscriberSchema: mongoose.Schema<any>;
