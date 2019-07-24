import mongoose from "mongoose";
export interface IStreamGoal {
    name: string;
    accomplished: boolean;
}
export declare const StreamGoalSchema: mongoose.Schema<any>;
