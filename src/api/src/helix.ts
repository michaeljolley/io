import * as queryString from 'query-string';

import { get, config } from './common';

export class Helix {

  private baseHelixUrl: string = 'https://api.twitch.tv/helix';
  private usersUrl: string = `${this.baseHelixUrl}/users`;
  private followersUrl: string = `${this.usersUrl}/follows`;
  private subscribersUrl: string = `${this.baseHelixUrl}/subscriptions`;
  private streamsUrl: string = `${this.baseHelixUrl}/streams`;

  public async getUserById(userId: string): Promise<any> {
    const queries = queryString.stringify({id: [userId]});
    const url = `${this.usersUrl}?${queries}`;

    return await get(url).then((data: any) => {
      return data.data[0];
    });
  }

  public async getUserByUsername(username: string): Promise<any> {
    const queries = queryString.stringify({login: [username]});
    const url = `${this.usersUrl}?${queries}`;

    return await get(url).then((data: any) => {
      return data.data[0];
    });
  }

  public async getFollowers(): Promise<any> {
    const queries = queryString.stringify({to_id: [config.twitchClientUserId], first: 1});
    const url = `${this.followersUrl}?${queries}`;

    return await get(url).then((data: any) => {
      return data;
    });
  }

  public async getSubscribers(): Promise<any> {
    let subscribers = [];

    let queries = queryString.stringify({broadcaster_id: [config.twitchClientUserId], first: 100});
    let url = `${this.subscribersUrl}?${queries}`;

    // Get first batch of up to 100
    let resp = await get(url).then((data: any) => {
                        return data;
                      });

    // Add to subscribers array
    subscribers = resp.data;
    let cursor: string = resp.pagination.cursor;

    while (resp.length === 100) {
      queries = queryString.stringify({broadcaster_id: [config.twitchClientUserId], first: 100, after: cursor});
      url = `${this.subscribersUrl}?${queries}`;
      resp = await get(url).then((data: any) => {
                      return data;
                    });
      subscribers.push(resp.data);
      cursor = resp.pagination.cursor;
    }

    return subscribers;
  }

  public async getStream(): Promise<any> {
    const queries: string = queryString.stringify({user_id: [config.twitchClientUserId], first: 1});
    const url: string = `${this.streamsUrl}?${queries}`;

    return await get(url).then((data: any) => {
      return data.data[0] || null;
    });
  }
}
