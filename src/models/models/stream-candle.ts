import { ICandle } from './candle';

export interface IStreamCandle {
  candle: ICandle;
  streamId: string;
}
