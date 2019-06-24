import * as queryString from 'query-string';

import { get, config } from './common';

export class Helix {

  private baseHelixUrl: string = 'https://api.twitch.tv/helix';
  private usersUrl: string = `${this.baseHelixUrl}/users`;
  private followersUrl: string = `${this.usersUrl}/follows`;
  private subscribersUrl: string = `${this.baseHelixUrl}/subscriptions`;
  private streamsUrl: string = `${this.baseHelixUrl}/streams`;

  private testStream: any = {
    "id" : "34604630896",
    "user_id" : "279965339",
    "user_name" : "theMichaelJolley",
// tslint:disable-next-line: object-literal-sort-keys
    "game_id" : "509670",
    "community_ids" : [ ],
    "type" : "live",
    "title" : "June 20, 2019 - Testing changes to statefulness of our chatbot and then working on a client project using Angular on a Raspberry Pi",
    "viewer_count" : 16,
    "started_at" : "2019-06-20T18:01:22Z",
    "language" : "en",
    "thumbnail_url" : "https://static-cdn.jtvnw.net/previews-ttv/live_user_themichaeljolley-{width}x{height}.jpg",
    "tag_ids" : [
      "a59f1e4e-257b-4bd0-90c7-189c3efbf917",
      "6f86127d-6051-4a38-94bb-f7b475dde109",
      "6ea6bca4-4712-4ab9-a906-e3336a9d8039"
    ]
  };

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
      return this.testStream; // data.data[0] || null;
    });
  }
}
