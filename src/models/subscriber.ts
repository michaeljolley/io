import { IUserInfo } from "./user-info";

export interface ISubscriber extends IUserInfo {

  wasGift: boolean;
  isRenewal: boolean;

  tier: string;
  streakMonths: number;

}
