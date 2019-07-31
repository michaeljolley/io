import * as queryString from 'query-string';

import { get, config, log } from '@shared/common';

// @deprecated
export class Kraken {
  private baseKrakenUrl: string = 'https://api.twitch.tv/kraken';
  private teamsUrl: string = `${this.baseKrakenUrl}/teams`;

  public async getTeamByName(name: string): Promise<any> {
    name = name.toLocaleLowerCase();
    const queries = queryString.stringify({
      "Client-ID": config.twitchClientUserId
    });
    const url = `${this.teamsUrl}/${name}?${queries}`;

    return await get(url).then((data: any) => {
      log('info', `getTeamByName: ${name}`);
      return data;
    });
  }
}