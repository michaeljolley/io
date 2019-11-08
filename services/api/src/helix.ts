import * as queryString from 'query-string';

import { get, config, log } from 'io-shared/common';

export class Helix {
  private baseHelixUrl: string = 'https://api.twitch.tv/helix';
  private usersUrl: string = `${this.baseHelixUrl}/users`;
  private followersUrl: string = `${this.usersUrl}/follows`;
  private subscribersUrl: string = `${this.baseHelixUrl}/subscriptions`;
  private subscribersEventsUrl: string = `${this.subscribersUrl}/events`;
  private streamsUrl: string = `${this.baseHelixUrl}/streams`;

  //   private testStream: any = {
  //     "id" : "99999999999",
  //     "user_id" : "279965339",
  //     "user_name" : "theMichaelJolley",
  // // tslint:disable-next-line: object-literal-sort-keys
  //     "game_id" : "509670",
  //     "community_ids" : [ ],
  //     "type" : "live",
  //     "title" : "July 12, 2019 - Testing changes to statefulness of our chatbot and then working on a client project using Angular on a Raspberry Pi",
  //     "viewer_count" : 16,
  //     "started_at" : "2019-07-12T18:01:22Z",
  //     "language" : "en",
  //     "thumbnail_url" : "https://static-cdn.jtvnw.net/previews-ttv/live_user_themichaeljolley-{width}x{height}.jpg",
  //     "tag_ids" : [
  //       "a59f1e4e-257b-4bd0-90c7-189c3efbf917",
  //       "6f86127d-6051-4a38-94bb-f7b475dde109",
  //       "6ea6bca4-4712-4ab9-a906-e3336a9d8039"
  //     ]
  //   };

  public async getUserById(userId: string): Promise<any> {
    const queries = queryString.stringify({ id: [userId] });
    const url = `${this.usersUrl}?${queries}`;

    return await get(url).then((data: any) => {
      return data.data[0];
    });
  }

  public async getUsersByUsername(username: string | string[]): Promise<any> {
    if (!Array.isArray(username)) {
      username = [username];
    }
    const queries = queryString.stringify({ login: username });
    const url = `${this.usersUrl}?${queries}`;
    return await get(url).then((body: any) => {
      return body.data.length > 1 ? body.data : body.data[0];
    });
  }

  public async getFollowers(): Promise<any> {
    const queries = queryString.stringify({
      to_id: [config.twitchClientUserId],
      first: 1
    });
    const url = `${this.followersUrl}?${queries}`;

    return await get(url).then((data: any) => {
      return data;
    });
  }

  public async getSubscribers(): Promise<any> {
    let subscribers = [];

    let queries = queryString.stringify({
      broadcaster_id: [config.twitchClientUserId],
      first: 100
    });
    let url = `${this.subscribersUrl}?${queries}`;

    // Get first batch of up to 100
    let resp = await get(url).then((data: any) => {
      return data;
    });

    // Add to subscribers array
    subscribers = resp.data;
    let cursor: string = resp.pagination.cursor;

    while (resp.length === 100) {
      queries = queryString.stringify({
        broadcaster_id: [config.twitchClientUserId],
        first: 100,
        after: cursor
      });
      url = `${this.subscribersUrl}?${queries}`;
      resp = await get(url).then((data: any) => {
        return data;
      });
      subscribers.push(resp.data);
      cursor = resp.pagination.cursor;
    }

    return subscribers;
  }

  public async getLastSubscriber(): Promise<any> {
    let subscriptionEvents = [];

    const queries = queryString.stringify({
      broadcaster_id: [config.twitchClientUserId]
    });
    const url = `${this.subscribersEventsUrl}?${queries}`;

    // Get first batch of up to 100
    const resp = await get(url).then((data: any) => {
      return data;
    });

    // Add to subscription event array
    subscriptionEvents = resp.data;

    let lastSubscriber: string = '';

    if (subscriptionEvents) {
      // loop through events and find:
      // first event with an event_type of subscriptions.notification
      // or event_type of subscriptions.subscribe and event_data.is_gift === true
      let i: number = 0;
      for (i = 0; i < subscriptionEvents.length; i++) {
        const eventData = subscriptionEvents[i];
        if (
          // tslint:disable-next-line: triple-equals
          eventData.event_type == "subscriptions.notification" ||
          // tslint:disable-next-line: triple-equals
          (eventData.event_type == "subscriptions.subscribe" &&
          eventData.event_data.is_gift === true)
        ) {
          lastSubscriber = subscriptionEvents[i].event_data.user_name;
          break;
        }
      }
    }

    log('info', `getLastSubscriber: ${lastSubscriber}`);
    return lastSubscriber;
  }

  public async getStream(): Promise<any> {
    // return this.testStream;
    const queries: string = queryString.stringify({
      user_id: [config.twitchClientUserId],
      first: 1
    });
    const url: string = `${this.streamsUrl}?${queries}`;
    return await get(url).then((data: any) => {
      return data.data[0] || null;
    });
  }
}
