import { ICandle } from './candle';
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

  segments?: IStreamSegment[];
  goals?: IStreamGoal[];
  notes?: IStreamNote[];

  candle?: ICandle;
  followers?: IUserInfo[];
  subscribers?: ISubscriber[];
  raiders?: IRaider[];
}
