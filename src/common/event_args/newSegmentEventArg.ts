import { IStreamSegment } from "../models";
import { IBaseEventArg } from "./baseEventArg";

export interface INewSegmentEventArg extends IBaseEventArg {
  streamId: string;
  streamSegment: IStreamSegment;
}
