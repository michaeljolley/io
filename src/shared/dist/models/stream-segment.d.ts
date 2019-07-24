import mongoose from "mongoose";
import { IUserInfo } from "./user-info";
export interface IStreamSegment {
    timestamp: string;
    topic: string;
    user: IUserInfo;
}
export declare const StreamSegmentSchema: mongoose.Schema<any>;
