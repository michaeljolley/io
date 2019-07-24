import { IRaider } from "../models";
import { IBaseEventArg } from "./baseEventArg";
export interface INewRaidEventArg extends IBaseEventArg {
    raider: IRaider;
    streamId: string;
}
