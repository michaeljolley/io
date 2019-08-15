import mongoose from "mongoose";

import { config, log } from "../common";
import { IGitHubRepo, GitHubRepoModel } from "../models";

export class RepoDb {
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
    }, (err: any) => {
      if (err) {
        log('info', `Err: ${JSON.stringify(err)}`);
        setTimeout(() => this.connect, 2000);
      }
      else {
        log('info', `All good holmes`);
      }
    });
  }

  public getRepos = async (): Promise<IGitHubRepo[]> => {
    return await new Promise((resolve: any) =>
      GitHubRepoModel.find((err: any, res: any) => {
        if (err) {
          log("info", JSON.stringify(err));
          resolve([]);
        }
        resolve(res);
      })
    );
  };

  public getRepo = async (fullName: string): Promise<IGitHubRepo[]> => {
    return await new Promise((resolve: any) =>
      GitHubRepoModel.find({ full_name: fullName }, (err: any, res: any) => {
        if (err) {
          log("info", JSON.stringify(err));
          resolve([]);
        }
        resolve(res);
      })
    );
  };

  public saveRepo = async (githubRepo: IGitHubRepo): Promise<IGitHubRepo> => {
    return await new Promise((resolve: any) => {
      GitHubRepoModel.findOneAndUpdate(
        { full_name: githubRepo.full_name },
        githubRepo,
        { upsert: true, new: true },
        (err: any, res: any) => {
          if (err) {
            log("info", `Error: saveRepo: ${JSON.stringify(err)}`);
            resolve(undefined);
          }
          log("info", `saveRepo: ${githubRepo.full_name}`);
          resolve(res);
        }
      );
    });
  };

}
