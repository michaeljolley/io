import mongoose from "mongoose";
import { IUserInfo } from "./user-info";
export interface IRaider {
    user: IUserInfo;
    viewers: number;
}
export declare const RaiderSchema: mongoose.Schema<any>;
