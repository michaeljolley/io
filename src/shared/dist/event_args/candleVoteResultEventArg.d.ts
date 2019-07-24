import { ICandle, ICandleVoteResult } from "../models";
import { IBaseEventArg } from "./baseEventArg";
export interface ICandleVoteResultEventArg extends IBaseEventArg {
    voteResults: ICandleVoteResult[];
    candles: ICandle[];
    streamId: string;
}
