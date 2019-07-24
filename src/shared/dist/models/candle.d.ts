import mongoose from "mongoose";
export interface ICandle extends mongoose.Document {
    name: string;
    label: string;
    url: string;
    isAvailable: boolean;
}
export declare const CandleModel: mongoose.Model<ICandle, {}>;
