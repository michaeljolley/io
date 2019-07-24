import mongoose from "mongoose";
import { IUserInfo } from "./user-info";
export interface ICheer {
    user: IUserInfo;
    bits: number;
}
export declare const CheerSchema: mongoose.Schema<any>;
