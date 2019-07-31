import { IBaseEventArg } from './baseEventArg';

import { ILiveCodersTeamMember } from '../models';

export interface IRetrievedLiveCodersTeamMembersEventArg extends IBaseEventArg {
  liveCodersTeamMembers: ILiveCodersTeamMember[];
}