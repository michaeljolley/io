import * as config from './config';
export { config };
export declare const isMod: (user: any) => boolean;
export declare const isBroadcaster: (user: any) => boolean;
export declare const log: (level: string, message: string) => void;
export declare const dir: (message: string, obj: any) => void;
export declare const getTime: () => {
    hours: string;
    minutes: string;
};
export declare const get: (url: string) => Promise<unknown>;
