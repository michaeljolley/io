import { IBaseEventArg } from './baseEventArg';
import { IGifter } from '../models/gifter';

export interface ICharityDetailEventArg extends IBaseEventArg {
  gifters: IGifter[];
}
