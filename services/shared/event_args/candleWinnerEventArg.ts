import { ICandle } from "../models";
import { IBaseEventArg } from "./baseEventArg";

export interface ICandleWinnerEventArg extends IBaseEventArg {
  candle: ICandle;
  streamId: string;
}
