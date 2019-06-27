import mongoose from "mongoose";

import { ICandle } from "./candle";
import { ICandleVote, CandleVoteSchema } from "./candle-vote";
import { IStreamSegment, StreamSegmentSchema } from "./stream-segment";
import { IStreamGoal, StreamGoalSchema } from "./stream-goal";
import { IStreamNote, StreamNoteSchema } from "./stream-note";
import { ICheer, CheerSchema } from "./cheer";
import { IUserInfo } from "./user-info";
import { ISubscriber, SubscriberSchema } from "./subscriber";
import { IRaider, RaiderSchema } from "./raider";

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

  followers?: IUserInfo[];
  subscribers?: ISubscriber[];
  raiders?: IRaider[];
  cheers?: ICheer[];
}

export const StreamModel = mongoose.model<IStream>(
  "Stream",
  new mongoose.Schema({
    id: { type: String, unique: true, required: true },
    title: { type: String, required: true },
    started_at: { type: String, required: true },
    ended_at: String,
    replayLink: String,
    candle: { type: mongoose.Schema.Types.ObjectId, ref: "Candle" },
    candleVotes: [CandleVoteSchema],

    segments: [StreamSegmentSchema],
    goals: [StreamGoalSchema],
    notes: [StreamNoteSchema],

    followers: [{ type: mongoose.Schema.Types.ObjectId, ref: "UserInfo" }],
    subscribers: [SubscriberSchema],
    raiders: [RaiderSchema],
    cheers: [CheerSchema]
  })
);
