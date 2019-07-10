import { IStream } from "../models";
import { IBaseEventArg } from "./baseEventArg";

export interface IStreamEventArg extends IBaseEventArg {
  stream: IStream;
}
