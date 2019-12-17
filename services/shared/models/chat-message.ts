import mongoose from "mongoose";
import { IUserInfo } from "./user-info";

export interface IChatMessage {
  message: string;
  timestamp: Date;
  user: IUserInfo;
}

export const ChatMessageSchema = new mongoose.Schema({
  message: String,
  timestamp: Date,
  user: {
    ref: "UserInfo",
    type: mongoose.Schema.Types.ObjectId
  }
});
