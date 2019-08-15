import mongoose from "mongoose";
import { IUserInfo } from "./user-info";

export interface ISubscriber {
  user: IUserInfo;
  wasGift: boolean;
  cumulativeMonths: number;
}

export const SubscriberSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "UserInfo"
  },
  wasGift: { type: Boolean, default: false, required: true },
  cumulativeMonths: { type: Number, default: 1, required: true }
});
