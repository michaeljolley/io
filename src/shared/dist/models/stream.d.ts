import mongoose from "mongoose";
import { ICandle } from "./candle";
import { ICandleVote } from "./candle-vote";
import { IStreamSegment } from "./stream-segment";
import { IStreamGoal } from "./stream-goal";
import { IStreamNote } from "./stream-note";
import { ICheer } from "./cheer";
import { IUserInfo } from "./user-info";
import { ISubscriber } from "./subscriber";
import { IRaider } from "./raider";
export interface IStream extends mongoose.Document {
    id: string;
    title: string;
    started_at: string;
    ended_at?: string;
    replayLink?: string;
    candle?: ICandle;
    candleVotes?: ICandleVote[];
    segments?: IStreamSegment[];
    goals?: IStreamGoal[];
    notes?: IStreamNote[];
    moderators?: IUserInfo[];
    followers?: IUserInfo[];
    subscribers?: ISubscriber[];
    raiders?: IRaider[];
    cheers?: ICheer[];
    contributors?: IUserInfo[];
}
export declare const StreamModel: mongoose.Model<IStream, {}>;
