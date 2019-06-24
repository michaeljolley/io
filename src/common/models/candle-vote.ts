import mongoose from "mongoose";
import { ICandle } from "./candle";
import { IUserInfo } from "./user-info";

export interface ICandleVote {
  user: IUserInfo;
  candle: ICandle;
}

export const CandleVoteSchema = new mongoose.Schema({
  user: {
    index: true,
    unique: true,
    type: mongoose.Schema.Types.ObjectId,
    ref: "UserInfo"
  },
  candle: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Candle"
  }
});
