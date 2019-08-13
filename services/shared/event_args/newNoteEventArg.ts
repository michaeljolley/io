import { IStreamNote } from "../models";
import { IBaseEventArg } from "./baseEventArg";

export interface INewNoteEventArg extends IBaseEventArg {
  streamId: string;
  streamNote: IStreamNote;
}
