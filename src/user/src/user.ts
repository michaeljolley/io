import express = require('express');
import { Server } from 'http';

import { get, log } from '@shared/common';
import { IUserInfo } from '@shared/models';
import { UserDb } from '@shared/db';


export class User {
  public app: express.Application;
  private http!: Server;

  private users: any = {};
  private usersUrl: string = 'http://api/users/';
  private userDb: UserDb;


  constructor() {
    this.app = express();
    this.http = new Server(this.app);
    this.userDb = new UserDb();

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
      log(
        'info',
        `route: /users/:username called with username: ${req.params.username}`
      );

      const payload: IUserInfo | undefined = await this.getUser(
        req.params.username
      );
      res.send(payload);
    });

    this.app.get('/update/:username', async (req, res) => {
      log(
        'info',
        `route: /update/:username called with username: ${req.params.username}`
      );

      const payload: IUserInfo | undefined = await this.updateUser(
        req.params.username
      );
      res.send(payload);
    });
  }

  private getUser = async (
    username: string
  ): Promise<IUserInfo | undefined> => {
    if (username == null) {
      return undefined;
    }

    username = username.toLocaleLowerCase();

    let user = this.users[username];

    if (user) {
      log('info', `Retrieved from cache: ${username}`);
      return user;
    }

    user = await this.userDb.getUserInfo(username);

    if (user) {
      log('info', `Retrieved from db: ${username}`);
      this.users[username] = user;
      return user;
    }

    const url = `${this.usersUrl}${username}`;

    user = await get(url);

    user = await this.userDb.saveUserInfo(user);

    log('info', `Retrieved from api: ${username}`);

    this.users[user.login] = user;
    return user;
  };

  private updateUser = async (
    username: string
  ): Promise<IUserInfo | undefined> => {
    if (username == null) {
      return undefined;
    }

    username = username.toLocaleLowerCase();

    const url = `${this.usersUrl}${username}`;

    let user: any = await get(url);

    user = await this.userDb.saveUserInfo(user);
    this.users[user.login] = user;

    log('info', `Updated ${username} from api`);

    return user;
  };


  /**
   * Start the Node.js server
   */
  private listen = (): void => {
    this.http.listen(80, () => {
      log('info', 'listening on *:80');
    });
  };
}
