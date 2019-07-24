import mongoose from "mongoose";
import { IUserInfo } from "./user-info";

export interface ICheer {
  user: IUserInfo;
  bits: number;
}

export const CheerSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "UserInfo"
  },
  bits: Number
});
