export interface ILiveCodersTeamMember {
  "_id": number;
  "display_name": string;
  "name": string;
  "url": string;
}

export interface ILiveCodersTeam {
  "name": string;
  "users": ILiveCodersTeamMember[];
}