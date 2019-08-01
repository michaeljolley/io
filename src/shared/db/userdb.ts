import mongoose from "mongoose";
import { config, log } from "../common";
import { IUserInfo, UserInfoModel } from "../models";

export class UserDb {
  constructor() {
    this.connect();
  }

  public getUserInfo = async (
    username: string
  ): Promise<IUserInfo | undefined> => {
    username = username.toLocaleLowerCase();
    return await new Promise((resolve: any) =>
      UserInfoModel.findOne({ login: username }, (err: any, res: any) => {
        if (err) {
          log("info", `Error: getUserInfo: ${JSON.stringify(err)}`);
          resolve(undefined);
        }
        log("info", `getUserInfo: ${username}`);
        resolve(res);
      })
    );
  };

  public saveUserInfo = async (userInfo: IUserInfo): Promise<IUserInfo> => {
    return await new Promise((resolve: any) =>
      UserInfoModel.findOneAndUpdate(
        { login: userInfo.login },
        userInfo,
        { upsert: true, new: true },
        (err: any, res: any) => {
          if (err) {
            log("info", `Error: saveUserInfo: ${JSON.stringify(err)}`);
            resolve(undefined);
          }
          log("info", `saveUserInfo: ${userInfo.login}`);
          resolve(res);
        }
      )
    );
  };

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
}
