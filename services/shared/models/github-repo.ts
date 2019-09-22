import mongoose from "mongoose";
import { IUserInfo } from "./user-info";

export interface IGitHubRepo extends mongoose.Document {
    description: string;
    full_name: string;
    id: number;
    issues_url: string;
    name: string;
    open_issues_count: number;
    private: boolean;
    contributors?: IUserInfo[];
}

export const GitHubRepoModel = mongoose.model<IGitHubRepo>(
    "GitHubRepo",
    new mongoose.Schema({
        description: String,
        full_name: String,
        id: { type: String, required: true },
        issues_url: String,
        name: String,
        open_issues_count: Number,
        private: Boolean,
        contributors: [{ type: mongoose.Schema.Types.ObjectId, ref: "UserInfo" }]
    })
);
