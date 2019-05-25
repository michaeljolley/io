import express = require('express');
import { Server } from 'http';
import * as restler from 'restler';
import * as queryString from 'query-string';

import { log } from './log';
import { APIResponse } from './api-response';

export class User {
  public app: express.Application;
  private http!: Server;

  private users: any[] = [];
  private usersUrl: string = 'http://api/users/';

  constructor() {
    this.app = express();
    this.http = new Server(this.app);

    this.loadRoutes();
    this.listen();
  }

  /**
   *
   */
  private loadRoutes = (): void => {

    // Get user by username
    this.app.get('/users/:username', async (req, res) => {
      log('info', `route: /users/:username called with username: ${req.params.username}`);

      const payload: APIResponse = await this.getUser(req.params.username);
      log('info',JSON.stringify(payload));
      res.send(payload.response);
    });
  }

  private getUser = (username: string): APIResponse => {
    const queries = queryString.stringify({login: [username]});
    const url = `${this.usersUrl}${queries}`;

    const user = this.users.filter(f => f.username.toLocaleLowerCase() == username.toLocaleLowerCase())[0];

    if (user) {
      return new APIResponse(200, "success", user, "OK");
    }
    else {

    }



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



  /**
   * Start the Node.js server
   */
  private listen = (): void => {
    this.http.listen(80, () => {
      log('info', 'listening on *:80');
    });
  };
}
