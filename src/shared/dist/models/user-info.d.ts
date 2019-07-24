import mongoose from "mongoose";
export interface IUserInfo extends mongoose.Document {
    id: string;
    login: string;
    display_name: string;
    broadcaster_type: string;
    profile_image_url: string;
}
export declare const UserInfoModel: mongoose.Model<IUserInfo, {}>;
