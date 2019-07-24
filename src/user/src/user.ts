import express = require('express');
import { Server } from 'http';

import { get, log } from '../../shared/src/common';
import { IUserInfo } from '../../shared/src/models';
import { UserDb } from '../../shared/src/db';


export class User {
  public app: express.Application;
  private http!: Server;

  private users: any[] = [];
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
  }

  private getUser = async (
    username: string
  ): Promise<IUserInfo | undefined> => {
    if (username == null) {
      return undefined;
    }

    username = username.toLocaleLowerCase();

    let user = this.users.find(
      f => f.login.toLocaleLowerCase() === username
    );

    if (user) {
      log('info', `Retrieved from cache: ${username}`);
      return user;
    }

    user = await this.userDb.getUserInfo(username);

    if (user) {
      log('info', `Retrieved from db: ${username}`);
      this.users.push(user);
      return user;
    }

    const url = `${this.usersUrl}${username}`;

    user = await get(url);

    log('info', `Retrieved from api: ${username}`);
    this.userDb.saveUserInfo(user)
        .then((success: boolean) => {

          this.userDb.getUserInfo(username)
              .then((savedUser: IUserInfo | undefined) => {
                if (savedUser) {
                  this.users.push(savedUser);
                  return savedUser;
                }
              })
              .catch((err: any) => {
                log('info', err);
                return undefined;
              });

        })
        .catch((err: any) => {
          log('info', err);
          return undefined;
        });
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
