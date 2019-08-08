import * as express from 'express';
import { Server } from 'http';

import { Helix } from './helix';
import { Kraken } from './kraken';
import { log } from '@shared/common';
import { IUserInfo } from '@shared/models';

export class API {
  public app: express.Application;
  private http!: Server;
  private helix: Helix;
  private kraken: Kraken;

  constructor() {
    this.app = express.default().use(express.json());
    this.http = new Server(this.app);
    this.helix = new Helix();
    this.kraken = new Kraken();

    this.loadRoutes();
  }

  public start() {
    this.listen();
  }

  /**
   *
   */
  private loadRoutes = (): void => {

    // Get team by name
    this.app.get('/team/:teamname', async (req, res) => {
      log('info', `route: /team/:teamname called with name: ${req.params.teamname}`);
      
      const payload: any = await this.kraken.getTeamByName(req.params.teamname);
      res.send(payload);
    });

    // Get user by userId
    this.app.get('/users/id/:userId', async (req, res) => {
      log('info', `route: /users/id/:userId called with userId: ${req.params.userId}`);

      const payload: any = await this.helix.getUserById(req.params.userId);
      res.send(payload);
    });

    // Get user by username
    this.app.get('/users/:username', async (req, res) => {
      log('info', `route: /users/:username called with username: ${req.params.username}`);

      const payload: any = await this.helix.getUsersByUsername(req.params.username);
      res.send(payload);
    });

    // Get user(s) by payload of usernames
    this.app.post('/users', async (req, res) => {
      if (!req.body) {
        log('info', `route: /users no payload available`);
        return;
      }
      log('info', `route: /users ${JSON.stringify(req.body)}`);
      const payload: IUserInfo[] = [];
      for (let i = 0; i < req.body.length; i += 100) {
        const usernames: string[] = req.body.slice(i, 100);
        const users = await this.helix.getUsersByUsername(usernames);
        payload.push(...users);
      }
      res.send(payload);
    });

    // Get latest follower by username
    this.app.get('/followers', async (req, res) => {
      log('info', `route: /followers called`);

      const payload: any = await this.helix.getFollowers();
      res.send(payload);
    });

    // Get all subscribers
    this.app.get('/subscribers', async (req, res) => {
      log('info', `route: /subscribers called`);

      const payload: any = await this.helix.getSubscribers();
      res.send(payload);
    });

    // Get last subscribers
    this.app.get('/subscribers/last', async (req, res) => {
      log('info', `route: /subscribers/last called`);

      const payload: any = await this.helix.getLastSubscriber();
      res.send(payload);
    });

    // Get stream info
    this.app.get('/stream', async (req, res) => {
      log('info', `route: /stream called`);

      const payload: any = await this.helix.getStream();
      res.send(payload);
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
