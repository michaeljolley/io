import { IGitHubRepo, IStream } from "../models";
import { IBaseEventArg } from "./baseEventArg";

export interface IStreamRepoChangedEventArg extends IBaseEventArg {
  stream: IStream;
  repo: IGitHubRepo;
}
