import { Schema } from "mongoose";
import { IUserInfo } from "./user-info";
export interface IStreamNote {
    user: IUserInfo;
    name: string;
}
export declare const StreamNoteSchema: Schema<any>;
