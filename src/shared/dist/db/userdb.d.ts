import { IUserInfo } from "../models";
export declare class UserDb {
    constructor();
    private connect;
    getUserInfo: (username: string) => Promise<IUserInfo | undefined>;
    saveUserInfo: (userInfo: IUserInfo) => Promise<boolean>;
}
