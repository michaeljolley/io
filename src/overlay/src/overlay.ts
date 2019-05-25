import express = require('express');
import { Server } from 'http';

import { log } from './log';

export class Overlay {
  public app: express.Application;
  private http!: Server;

  constructor() {
    this.app = express();
    this.app.use(express.static('dist/wwwroot'));

    this.http = new Server(this.app);

    this.listen();
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

