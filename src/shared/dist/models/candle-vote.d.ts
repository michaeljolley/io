import mongoose from "mongoose";
import { ICandle } from "./candle";
import { IUserInfo } from "./user-info";
export interface ICandleVote {
    user: IUserInfo;
    candle: ICandle;
}
export declare const CandleVoteSchema: mongoose.Schema<any>;
