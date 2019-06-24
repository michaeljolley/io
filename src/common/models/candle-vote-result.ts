import { ICandle } from "./candle";

export interface ICandleVoteResult extends ICandle {
  votes?: number;
}
