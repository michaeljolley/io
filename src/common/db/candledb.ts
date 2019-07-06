import mongoose from "mongoose";

import { config, log } from "../common";
import { ICandle, CandleModel } from "../models";

export class CandleDb {
  constructor() {
    this.connect();
  }

  private connect() {
    mongoose.connect(config.mongoDBConnectionString, {
      pass: config.mongoDBPassword,
      user: config.mongoDBUser,
      dbName: config.mongoDBDatabase,
      useCreateIndex: true,
      useFindAndModify: false,
      useNewUrlParser: true
    }, (err) => {
      if (err) {
        log('info', `Err: ${JSON.stringify(err)}`);
        setTimeout(() => this.connect, 2000);
      }
      else {
        log('info', `All good holmes`);
      }
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
