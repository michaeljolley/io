import mongoose from "mongoose";
import { IUserInfo } from "./user-info";

export interface ISubscriber {
  user: IUserInfo;
  wasGift: boolean;
}

export const SubscriberSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "UserInfo"
  },
  wasGift: { type: Boolean, default: false, required: true }
});
