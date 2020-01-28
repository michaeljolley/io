import mongoose from 'mongoose';

import { ICandle } from './candle';
import { ICandleVote, CandleVoteSchema } from './candle-vote';
import { IStreamSegment, StreamSegmentSchema } from './stream-segment';
import { IStreamGoal, StreamGoalSchema } from './stream-goal';
import { IStreamNote, StreamNoteSchema } from './stream-note';
import { ICheer, CheerSchema } from './cheer';
import { IUserInfo } from './user-info';
import { ISubscriber, SubscriberSchema } from './subscriber';
import { IRaider, RaiderSchema } from './raider';
import { IGitHubRepo } from './github-repo';
import { ChatMessageSchema, IChatMessage } from './chat-message';

export interface IStream extends mongoose.Document {
  id: string;
  title: string;
  streamDate: string;
  started_at: Date;
  ended_at?: string;
  replayLink?: string;

  candle?: ICandle;
  candleVotes?: ICandleVote[];

  segments?: IStreamSegment[];
  goals?: IStreamGoal[];
  notes?: IStreamNote[];

  githubRepos?: IGitHubRepo[];

  moderators?: IUserInfo[];
  followers?: IUserInfo[];
  subscribers?: ISubscriber[];
  raiders?: IRaider[];
  cheers?: ICheer[];
  contributors?: IUserInfo[];
  chatMessages?: IChatMessage[];
}

export const StreamModel = mongoose.model<IStream>(
  'Stream',
  new mongoose.Schema({
    id: { type: String, unique: true, required: true, index: true },
    started_at: { type: Date, required: true, index: true },
    streamDate: { type: String, required: true, index: true },
    ended_at: String,
    title: { type: String, required: true },
    replayLink: String,

    candle: { type: mongoose.Schema.Types.ObjectId, ref: 'Candle' },
    candleVotes: [CandleVoteSchema],

    segments: [StreamSegmentSchema],
    goals: [StreamGoalSchema],
    notes: [StreamNoteSchema],

    githubRepos: [{ type: mongoose.Schema.Types.ObjectId, ref: 'GitHubRepo' }],

    moderators: [{ type: mongoose.Schema.Types.ObjectId, ref: 'UserInfo' }],
    followers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'UserInfo' }],
    subscribers: [SubscriberSchema],
    raiders: [RaiderSchema],
    cheers: [CheerSchema],
    contributors: [{ type: mongoose.Schema.Types.ObjectId, ref: 'UserInfo' }],
    chatMessages: [ChatMessageSchema]
  })
);
