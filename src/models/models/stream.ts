import { ICandle } from './candle';
import { ICandleVote } from './candle-vote';
import { IRaider } from './raider';
import { ISubscriber } from './subscriber';
import { IStreamGoal } from './stream-goal';
import { IStreamNote } from './stream-note';
import { IStreamSegment } from './stream-segment';
import { IUserInfo } from './user-info';

export interface IStream {

  streamId: string;
  title: string;
  started_at: string;
  ended_at: string;
  replayLink: string;

  candle?: ICandle;
  candleVotes?: ICandleVote[];

  segments?: IStreamSegment[];
  goals?: IStreamGoal[];
  notes?: IStreamNote[];

  followers?: IUserInfo[];
  subscribers?: ISubscriber[];
  raiders?: IRaider[];
}
