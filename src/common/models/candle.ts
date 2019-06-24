import mongoose from "mongoose";

export interface ICandle extends mongoose.Document {
  name: string;
  label: string;
  url: string;
  isAvailable: boolean;
}

export const CandleModel = mongoose.model<ICandle>(
  "Candle",
  new mongoose.Schema({
    isAvailable: Boolean,
    label: String,
    name: String,
    url: String
  })
);
