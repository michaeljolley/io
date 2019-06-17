import express = require('express');
import mongodb = require('mongodb');
import { Server } from 'http';
import { config, get, log } from './common';

export class User {
  public app: express.Application;
  private http!: Server;

  private users: any[] = [];
  private usersUrl: string = 'http://api/users/';
  private mongoClient = mongodb.MongoClient;

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

    let user = this.users.find(f => f.login.toLocaleLowerCase() === username.toLocaleLowerCase());

    if (user) {
      log('info', `Retrieved from cache: ${username}`);
      return user;
    }

    const mongoClient: mongodb.MongoClient = await new Promise((resolve: any) =>
      this.mongoClient.connect(config.mongoDBConnectionString, (err, client) => { resolve(client); }));

    const db = mongoClient.db('iodb');

    if (db.collection('users') !== undefined) {
      user = await db.collection('users').findOne({ login: username.toLocaleLowerCase() });
    }

    if (user) {
      log('info', `Retrieved from db: ${username}`);
    }
    else {
      const url = `${this.usersUrl}${username}`;

      user = await get(url);

      log('info', `Retrieved from api: ${username}`);
      await db.collection('users').insertOne(user);
      this.users.push(user);
    }

    await mongoClient.close();

    return user;
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
