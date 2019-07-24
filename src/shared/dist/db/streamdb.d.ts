import { IStream, IVote, ISubscriber, ICheer, IRaider, IUserInfo, IStreamSegment, IStreamGoal, IStreamNote } from "../models";
export declare class StreamDb {
    constructor();
    private connect;
    getStream: (streamId: string) => Promise<IStream | undefined>;
    saveStream: (stream: any) => Promise<boolean>;
    recordSubscriber: (streamId: string, subscriber: ISubscriber) => Promise<boolean>;
    recordSegment: (streamId: string, segment: IStreamSegment) => Promise<boolean>;
    recordGoal: (streamId: string, goal: IStreamGoal) => Promise<boolean>;
    recordNote: (streamId: string, note: IStreamNote) => Promise<boolean>;
    recordUser: (streamId: string, type: string, user: IUserInfo) => Promise<boolean>;
    recordRaid: (streamId: string, raider: IRaider) => Promise<boolean>;
    recordCheer: (streamId: string, cheerer: ICheer) => Promise<boolean>;
    recordCandleVote: (vote: IVote) => Promise<boolean>;
}
