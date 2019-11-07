import { IStreamSegment } from '../models';
import { IBaseEventArg } from './baseEventArg';

export interface INewSegmentEventArg extends IBaseEventArg {
  streamDate: string;
  streamSegment: IStreamSegment;
}
