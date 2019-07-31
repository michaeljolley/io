import mongoose from "mongoose";

export interface IUserInfo extends mongoose.Document {
  id: string;
  liveCodersTeamMember: boolean;
  login: string;
  display_name: string;
  broadcaster_type: string;
  profile_image_url: string;
}

export const UserInfoModel = mongoose.model<IUserInfo>(
  "UserInfo",
  new mongoose.Schema({
    broadcaster_type: String,
    display_name: String,
    id: { type: String, required: true },
    liveCodersTeamMember: Boolean,
    login: String,
    profile_image_url: String,
  })
);
