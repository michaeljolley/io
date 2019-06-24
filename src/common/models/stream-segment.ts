import mongoose from "mongoose";

export interface IStreamSegment {
  timestamp: string;
  topic: string;
}

export const StreamSegmentSchema = new mongoose.Schema({
  timestamp: { type: String, required: true },
  topic: { type: String, required: true }
});
