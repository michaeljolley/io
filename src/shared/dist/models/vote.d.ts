import { IUserInfo, ICandle } from ".";
export interface IVote {
    streamId: string;
    user: IUserInfo;
    candle: ICandle;
}
