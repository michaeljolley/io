import * as restler from 'restler';
import * as queryString from 'query-string';


import { log } from './log';
import { APIResponse } from './api-response';

export class Helix {

  private usersUrl: string = 'https://api.twitch.tv/helix/users?';

  public async getUserById(userId: string): Promise<APIResponse> {
    const queries = queryString.stringify({id: [userId]});
    const url = `${this.usersUrl}${queries}`;

    return await this.get(url).then((data: any) => {
              return new APIResponse(200, "success", data, "OK");
          });
  }

  public async getUserByUsername(username: string): Promise<APIResponse> {
    const queries = queryString.stringify({login: [username]});
    const url = `${this.usersUrl}${queries}`;

    return await this.get(url).then((data: any) => {
              return new APIResponse(200, "success", data, "OK");
          });
  }

  private get = (url: string) => {
    return new Promise((resolve, reject) => {
        restler.get(url, {
            headers: {
                "Client-ID": 'nf56rsp3y60xsj86p5pm6wqagil1ta',
                "Content-Type": "application/json"
            }
        }).on("complete", (data: any) => {
            resolve(data);
        });
    });
  }
}
