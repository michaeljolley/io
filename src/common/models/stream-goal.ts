import mongoose from "mongoose";

export interface IStreamGoal {
  name: string;
  accomplished: boolean;
}

export const StreamGoalSchema = new mongoose.Schema({
  accomplished: { type: Boolean, default: false, required: true },
  name: { type: String, required: true }
});
