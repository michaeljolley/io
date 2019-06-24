import mongoose from "mongoose";
import { config, log } from "../common";
import { IUserInfo, UserInfoModel } from "../models";

export class UserDb {
  constructor() {
    mongoose.connect(config.mongoDBConnectionString, {
      useNewUrlParser: true,
      useFindAndModify: false,
      useCreateIndex: true
    });
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

  public saveUserInfo = async (userInfo: IUserInfo): Promise<boolean> => {
    return await new Promise((resolve: any) =>
      UserInfoModel.findOneAndUpdate(
        { login: userInfo.login },
        userInfo,
        { upsert: true },
        (err: any, res: any) => {
          if (err) {
            log("info", `Error: saveUserInfo: ${JSON.stringify(err)}`);
            resolve(false);
          }
          log("info", `saveUserInfo: ${userInfo.login}`);
          resolve(true);
        }
      )
    );
  };
}
