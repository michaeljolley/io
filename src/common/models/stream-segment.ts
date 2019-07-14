import mongoose from "mongoose";
import { IUserInfo } from "./user-info";

export interface IStreamSegment {
  timestamp: string;
  topic: string;
  user: IUserInfo;
}

export const StreamSegmentSchema = new mongoose.Schema({
  timestamp: { type: String, required: true },
  topic: { type: String, required: true },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "UserInfo"
  }
});
