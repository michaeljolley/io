import * as queryString from 'query-string';

import { get } from './common';

import { APIResponse } from './api-response';

export class Helix {

  private usersUrl: string = 'https://api.twitch.tv/helix/users?';

  public async getUserById(userId: string): Promise<APIResponse> {
    const queries = queryString.stringify({id: [userId]});
    const url = `${this.usersUrl}${queries}`;

    return await get(url).then((data: any) => {
      return data.data[0];
    });
  }

  public async getUserByUsername(username: string): Promise<any> {
    const queries = queryString.stringify({login: [username]});
    const url = `${this.usersUrl}${queries}`;

    return await get(url).then((data: any) => {
      return data.data[0];
    });
  }
}
