import { get, log } from '@shared/common';

// @deprecated
export class Kraken {
  private baseKrakenUrl: string = 'https://api.twitch.tv/kraken';
  private teamsUrl: string = `${this.baseKrakenUrl}/teams`;

  public async getTeamByName(name: string): Promise<any> {
    name = name.toLocaleLowerCase();
    const url = `${this.teamsUrl}/${name}`;

    // Call the Kraken API using the application/vnd.twitchtv.v5+json 'Accept' header to
    // tell Twitch we expect a response from the v5 API not v3.
    return await get(url, {"Accept": "application/vnd.twitchtv.v5+json"}).then((data: any) => {
      log('info', `getTeamByName: ${name}`);
      return data;
    });
  }
}