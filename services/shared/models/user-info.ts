import mongoose from "mongoose";

export interface IUserInfo extends mongoose.Document {
  broadcaster_type: string;
  display_name: string;
  id: string;
  liveCodersTeamMember: boolean;
  login: string;
  profile_image_url: string;
  lastUpdated: string;
  githubHandle: string;
  twitterHandle: string;
}

export const UserInfoModel = mongoose.model<IUserInfo>(
  "UserInfo",
  new mongoose.Schema({
    broadcaster_type: String,
    display_name: String,
    githubHandle: String,
    id: { type: String, required: true },
    lastUpdated: String,
    liveCodersTeamMember: Boolean,
    login: String,
    profile_image_url: String,
    twitterHandle: String
  })
);
