import mongoose from "mongoose";
import { IUserInfo } from "./user-info";

export interface IRaider {
  user: IUserInfo;
  viewers: number;
}

export const RaiderSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "UserInfo"
  },
  viewers: Number
});
