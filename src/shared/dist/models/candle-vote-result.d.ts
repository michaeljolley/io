import { ICandle } from "./candle";
import { IUserInfo } from "./index";
export interface ICandleVoteResult {
    candle: ICandle;
    votes: number;
    voters: IUserInfo[];
}
