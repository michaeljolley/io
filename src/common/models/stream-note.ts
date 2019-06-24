import { Schema } from "mongoose";
import { IUserInfo } from "./user-info";

export interface IStreamNote {
  user: IUserInfo;
  name: string;
}

export const StreamNoteSchema = new Schema({
  name    : { type: String, required: true },
  user    : {
            type: Schema.Types.ObjectId,
            ref: 'UserInfo'
          }
});
