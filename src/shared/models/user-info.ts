import mongoose from "mongoose";

export interface IUserInfo extends mongoose.Document {
  broadcaster_type: string;
  display_name: string;
  id: string;
  login: string;
  profile_image_url: string;
  lastSeen: string;
  lastUpdated: string;
}

export const UserInfoModel = mongoose.model<IUserInfo>(
  "UserInfo",
  new mongoose.Schema({
    broadcaster_type: String,
    display_name: String,
    id: { type: String, required: true },
    lastSeen: String,
    lastUpdated: String,
    login: String,
    profile_image_url: String
  })
);
