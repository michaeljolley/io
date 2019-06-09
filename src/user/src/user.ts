import express = require('express');
import { Server } from 'http';

import { get, log } from './common';

export class User {
  public app: express.Application;
  private http!: Server;

  private users: any[] = [];
  private usersUrl: string = 'http://api/users/';

  constructor() {
    this.app = express();
    this.http = new Server(this.app);

    this.loadRoutes();
  }

  public start() {
    this.listen();
  }

  /**
   *
   */
  private loadRoutes() {

    // Get user by username
    this.app.get('/users/:username', async (req, res) => {
      log('info', `route: /users/:username called with username: ${req.params.username}`);

      const payload: any = await this.getUser(req.params.username);
      res.send(payload);
    });
  }

  private getUser = async (username: string): Promise<any> => {
    let user = this.users.filter(f => f.login.toLocaleLowerCase() === username.toLocaleLowerCase())[0];

    if (user) {
      return user;
    }
    else {
      const url = `${this.usersUrl}${username}`;

      return await get(url).then((data: any) => {
        user = data;
        this.users.push(user);
        return user;
      });
    }
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
