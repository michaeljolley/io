import mongoose from "mongoose";

import { config, log } from "../common";
import { ICandle, CandleModel } from "../models";

export class CandleDb {
  constructor() {
    mongoose.connect(config.mongoDBConnectionString, {
      useNewUrlParser: true,
      useFindAndModify: false,
      useCreateIndex: true
    });
  }

  public getCandles = async (): Promise<ICandle[]> => {
    return await new Promise((resolve: any) =>
      CandleModel.find({ isAvailable: true }, (err: any, res: any) => {
        if (err) {
          log("info", JSON.stringify(err));
          resolve([]);
        }
        resolve(res);
      })
    );
  };
}
