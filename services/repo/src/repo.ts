import * as express from 'express';
import { Server } from 'http';

import { log } from '@shared/common';
import { IGitHubRepo } from '@shared/models';
import { RepoDb } from '@shared/db';


export class Repo {
  public app: express.Application;
  private http!: Server;

  private repos: any = {};
  private repoDb: RepoDb;

  constructor() {
    this.app = express.default().use(express.json());
    this.http = new Server(this.app);
    this.repoDb = new RepoDb();

    this.loadRoutes();
  }

  public start() {
    this.listen();
  }

  /**
   *
   */
  private loadRoutes() {
    // Get repo by full_name
    this.app.get('/repos/:fullname', async (req, res) => {
      log(
        'info',
        `route: /repos/:fullname called with fullname: ${req.params.fullname}`
      );

      const payload: IGitHubRepo | undefined = await this.getRepo(
        req.params.fullname
      );
      res.send(payload);
    });

    this.app.post('/refresh', async (req, res) => {
      if (!req.body) {
        log(
          'info',
          `route: /refresh called with empty payload. Aborting...`
        )
        return;
      }
      log(
        'info',
        `route: /refresh ${JSON.stringify(req.body)}`
      )
      this.updateRepos(req.body);
    });
  }

  private updateRepos = async (reposToUpdate: IGitHubRepo[]) : Promise<void> => {
    if (reposToUpdate === undefined
        || reposToUpdate.length == 0) {
        return;
    };

    for (const repo of reposToUpdate) {
      repo.full_name = repo.full_name.toLocaleLowerCase();
      await this.repoDb.saveRepo(repo);
    }

    return;
  }

  private getRepo = async (
    fullname: string
  ): Promise<IGitHubRepo | undefined> => {
    if (fullname == null) {
      return undefined;
    }

    fullname = fullname.toLocaleLowerCase();

    let repo = this.repos[fullname];

    if (repo) {
      log('info', `Retrieved from cache: ${repo.full_name}`);
      return repo;
    }

    repo = await this.repoDb.getRepo(fullname);

    if (repo) {
      log('info', `Retrieved from db: ${repo.full_name}`);
      this.repos[fullname] = repo;
      return repo;
    }

    return undefined;
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
