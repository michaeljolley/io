import mongoose from "mongoose";

export interface IUserInfo extends mongoose.Document {
  id: string;
  login: string;
  display_name: string;
  broadcaster_type: string;
  profile_image_url: string;
}

export const UserInfoModel = mongoose.model<IUserInfo>(
  "UserInfo",
  new mongoose.Schema({
    id: { type: String, required: true },
    login: String,
    display_name: String,
    broadcaster_type: String,
    profile_image_url: String
  })
);
