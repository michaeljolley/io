import mongoose from "mongoose";

import { config, log } from "../common";
import { IStream, StreamModel, IVote, ICandleVote } from "../models";

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



  public recordCandleVote = async (
    vote: IVote
  ): Promise<boolean> => {
    log('info', `recordCandleVote: ${JSON.stringify(vote)}`);

    const stream = await this.getStream(vote.streamId);

    if (stream &&
        stream.candleVotes &&
        stream.candleVotes.find((f: ICandleVote) => f.user._id === vote.user._id)) {
      // modify existing vote
      return await new Promise((resolve: any) =>
        StreamModel.updateOne(
          { id: vote.streamId, candleVotes: { $elemMatch: { user: vote.user._id }}},
          { $set: { 'candleVotes.$.candle': vote.candle._id } },
          (err: any, res: any) => {
            if (err) {
              log("info", `ERROR: recordCandleVote (existing) ${JSON.stringify(err)}`);
              resolve(false);
            }
            resolve(true);
          }
        )
      );
    }
    else {
      // record new vote
      return await new Promise((resolve: any) =>
        StreamModel.updateOne(
          { id: vote.streamId },
          { $push: { 'candleVotes': { user: vote.user._id, candle: vote.candle._id } } },
          (err: any, res: any) => {
            if (err) {
              log("info", `ERROR: recordCandleVote (new) ${JSON.stringify(err)}`);
              resolve(false);
            }
            resolve(true);
          }
        )
      );
    }
  };
}
