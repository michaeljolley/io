import mongoose from "mongoose";

import { config, log } from "../common";
import {
  IStream,
  StreamModel,
  IVote,
  ICandleVote,
  ISubscriber,
  ICheer,
  IRaider
} from "../models";

export class StreamDb {
  constructor() {
    mongoose.connect(config.mongoDBConnectionString, {
      useNewUrlParser: true,
      useFindAndModify: false,
      useCreateIndex: true
    });
  }

  public getStream = async (streamId: string): Promise<IStream | undefined> => {
    return await new Promise((resolve: any) =>
      StreamModel.findOne({ id: streamId })
        .populate("candle")
        .populate("candleVotes.user")
        .populate("candleVotes.candle")
        .populate("notes.user")
        .populate("followers")
        .populate("subscribers.user")
        .populate("raiders.user")
        .populate("cheers.user")
        .exec((err: any, res: any) => {
          if (err) {
            log("info", `ERROR: getStream ${JSON.stringify(err)}`);
            resolve(undefined);
          }
          log("info", `getStream: ${streamId}`);
          resolve(res);
        })
    );
  };

  public saveStream = async (stream: any): Promise<boolean> => {
    return await new Promise((resolve: any) =>
      StreamModel.findOneAndUpdate(
        { id: stream.id },
        stream,
        { upsert: true },
        (err: any, res: any) => {
          if (err) {
            log("info", `ERROR: saveStream ${JSON.stringify(err)}`);
            resolve(false);
          }
          log("info", `saveStream: ${stream.id}`);
          resolve(true);
        }
      )
    );
  };

  public recordSubscriber = async (
    streamId: string,
    subscriber: ISubscriber
  ): Promise<boolean> => {
    log("info", `recordSubscriber: ${subscriber.user.login}`);

    const stream = await this.getStream(streamId);

    if (
      stream &&
      (stream.subscribers == null ||
        stream.subscribers.find(
          (f: ISubscriber) => f.user._id === subscriber.user._id
        ) === undefined)
    ) {
      // record subscriber
      return await new Promise((resolve: any) =>
        StreamModel.updateOne(
          { id: streamId },
          {
            $push: {
              subscribers: { user: subscriber.user._id, wasGift: subscriber.wasGift }
            }
          },
          (err: any, res: any) => {
            if (err) {
              log(
                "info",
                `ERROR: recordSubscriber ${JSON.stringify(err)}`
              );
              resolve(false);
            }
            resolve(true);
          }
        )
      );
    }
    return false;
  };

  public recordRaid = async (
    streamId: string,
    raider: IRaider
  ): Promise<boolean> => {
    log("info", `recordRaid: ${raider.user.login}`);

    const stream = await this.getStream(streamId);

    if (
      stream &&
      (stream.raiders == null ||
        stream.raiders.find(
          (f: IRaider) => f.user._id === raider.user._id
        ) === undefined)
    ) {
      // record raider
      return await new Promise((resolve: any) =>
        StreamModel.updateOne(
          { id: streamId },
          {
            $push: {
              raiders: { user: raider.user._id, viewers: raider.viewers }
            }
          },
          (err: any, res: any) => {
            if (err) {
              log(
                "info",
                `ERROR: recordRaid ${JSON.stringify(err)}`
              );
              resolve(false);
            }
            resolve(true);
          }
        )
      );
    }
    return false;
  };

  public recordCheer = async (
    streamId: string,
    cheerer: ICheer
  ): Promise<boolean> => {
    log("info", `recordCheer: ${cheerer.user.login}`);

    // record cheer
    return await new Promise((resolve: any) =>
      StreamModel.updateOne(
        { id: streamId },
        {
          $push: {
            cheers: { user: cheerer.user._id, bits: cheerer.bits }
          }
        },
        (err: any, res: any) => {
          if (err) {
            log(
              "info",
              `ERROR: recordCheer ${JSON.stringify(err)}`
            );
            resolve(false);
          }
          resolve(true);
        }
      )
    );
  };

  public recordCandleVote = async (vote: IVote): Promise<boolean> => {
    log("info", `recordCandleVote: ${JSON.stringify(vote)}`);

    const stream = await this.getStream(vote.streamId);

    if (
      stream &&
      stream.candleVotes &&
      stream.candleVotes.find((f: ICandleVote) => f.user._id == vote.user._id)
    ) {
      // modify existing vote
      return await new Promise((resolve: any) =>
        StreamModel.updateOne(
          {
            id: vote.streamId,
            candleVotes: { $elemMatch: { user: vote.user._id } }
          },
          { $set: { "candleVotes.$.candle": vote.candle._id } },
          (err: any, res: any) => {
            if (err) {
              log(
                "info",
                `ERROR: recordCandleVote (existing) ${JSON.stringify(err)}`
              );
              resolve(false);
            }
            log(
              "info",
              `recordCandleVote (existing)`
            );
            resolve(true);
          }
        )
      );
    } else {
      // record new vote
      return await new Promise((resolve: any) =>
        StreamModel.updateOne(
          { id: vote.streamId },
          {
            $push: {
              candleVotes: { user: vote.user._id, candle: vote.candle._id }
            }
          },
          (err: any, res: any) => {
            if (err) {
              log(
                "info",
                `ERROR: recordCandleVote (new) ${JSON.stringify(err)}`
              );
              resolve(false);
            }
            log(
              "info",
              `recordCandleVote (new)`
            );
            resolve(true);
          }
        )
      );
    }
  };
}
