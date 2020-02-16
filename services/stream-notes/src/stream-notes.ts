import io from 'socket.io-client';
import fs from 'fs';
import moment from 'moment';
import rimraf from 'rimraf';
import simplegit from 'simple-git/promise';

import { config, log } from '@shared/common';
import { StreamDb } from '@shared/db';
import { IStream } from '@shared/models';
import { SocketIOEvents } from '@shared/events';

export class StreamNotes {
  private socket!: SocketIOClient.Socket;
  private gitHubRepoUrl: string = `https://${config.githubUsername}:${config.githubAuthToken}@github.com/${config.githubUsername}/${config.githubRepo}.git`;
  private repoDirectory: string = config.githubRepo;

  private streamDb: StreamDb;
  private git: simplegit.SimpleGit = simplegit();

  private streamNoteName: string = '';
  private streamNoteDir: string = '';
  private activeStream: IStream | undefined;

  constructor() {
    this.socket = io('http://hub');
    this.streamDb = new StreamDb();

    if (!fs.existsSync(__dirname + '/tmp')) {
      fs.mkdirSync(__dirname + '/tmp');
    }

    this.socket.on(SocketIOEvents.StreamNoteRebuild, (streamDate: string) =>
      this.onStreamNoteRebuild(streamDate)
    );
  }

  /**
   * Start stream notes processes
   */
  public start() {
    log('info', 'Stream Notes is online and running...');
  }

  private initGit = async (): Promise<any> => {
    return await new Promise((resolve: any, reject: any) => {
      if (fs.existsSync(`${__dirname}/tmp/${this.repoDirectory}`)) {
        rimraf.sync(`${__dirname}/tmp/${this.repoDirectory}`);
      }

      if (!fs.existsSync(`${__dirname}/tmp/${this.repoDirectory}`)) {
        fs.mkdirSync(`${__dirname}/tmp/${this.repoDirectory}`);
      }

      this.git = simplegit(`${__dirname}/tmp/${this.repoDirectory}`);

      resolve(true);
    });
  };

  private configureGit = async (): Promise<any> => {
    return await new Promise((resolve: any, reject: any) => {
      this.git
        .addConfig('user.name', config.githubName)
        .then((val: string) => {
          this.git
            .addConfig('user.email', config.githubEmailAddress)
            .then((val2: string) => {
              log('info', 'git configured');
              resolve(true);
            })
            .catch((err: any) => {
              log('info', `configureGet: ERR: ${err}`);
              reject(err);
            });
        })
        .catch((err: any) => {
          log('info', `configureGet: ERR: ${err}`);
          reject(err);
        });
    });
  };

  private clone = async (): Promise<any> => {
    return await new Promise((resolve: any, reject: any) => {
      this.git
        .clone(this.gitHubRepoUrl, __dirname + `/tmp/${this.repoDirectory}`)
        .then((value: string) => {
          log(
            'info',
            `Successfully cloned ${config.githubUsername}/${config.githubRepo}`
          );

          resolve(value);
        })
        .catch((err: any) => {
          reject(err);
        });
    });
  };

  private branch = async (): Promise<any> => {
    return await new Promise((resolve: any, reject: any) =>
      this.git
        .checkoutLocalBranch('jsonStreamNotes')
        .then(() => {
          log('info', `Successfully checked out jsonStreamNotes`);
          resolve('jsonStreamNotes');
        })
        .catch((err: any) => {
          reject(err);
        })
    );
  };

  private add = async (): Promise<any> => {
    return await new Promise((resolve: any, reject: any) =>
      this.git
        .add('./*')
        .then(() => {
          log('info', `Successfully added file json`);
          resolve('json');
        })
        .catch((err: any) => {
          reject(err);
        })
    );
  };

  private commit = async (): Promise<any> => {
    return await new Promise((resolve: any, reject: any) =>
      this.git
        .commit(`Adding JSON for all stream notes`)
        .then(() => {
          log('info', `Successfully committed file json`);
          resolve('json');
        })
        .catch((err: any) => {
          reject(err);
        })
    );
  };

  private push = async (): Promise<any> => {
    return await new Promise((resolve: any, reject: any) =>
      this.git
        .push(this.gitHubRepoUrl, 'jsonStreamNotes')
        .then(() => {
          log('info', `Successfully pushed branch: 'jsonStreamNotes'`);
          resolve('json');
        })
        .catch((err: any) => {
          reject(err);
        })
    );
  };

  private generateJSONFile = async (): Promise<any> => {
    return await new Promise((resolve: any, reject: any) => {
      const mkdnStream = this.activeStream!;

      // Ensure directories exist
      if (
        !fs.existsSync(
          `${__dirname}/tmp/${this.repoDirectory}/_streams/${moment(
            mkdnStream.started_at
          ).format('YYYY')}/`
        )
      ) {
        fs.mkdirSync(
          `${__dirname}/tmp/${this.repoDirectory}/_streams/${moment(
            mkdnStream.started_at
          ).format('YYYY')}`
        );
      }

      if (
        !fs.existsSync(
          `${__dirname}/tmp/${this.repoDirectory}/${this.streamNoteDir}`
        )
      ) {
        fs.mkdirSync(
          `${__dirname}/tmp/${this.repoDirectory}/${this.streamNoteDir}`
        );
      }

      fs.writeFileSync(
        __dirname +
          `/tmp/${this.repoDirectory}/${this.streamNoteDir}${this.streamNoteName}.json`,
        JSON.stringify(this.activeStream)
      );
      log(
        'info',
        `Stream notes added to '${__dirname}/tmp/${this.repoDirectory}/${this.streamNoteDir}${this.streamNoteName}.json'!`
      );
      resolve('json');
    });
  };

  private cleanUp = () => {
    this.activeStream = undefined;
    this.streamNoteName = '';
    this.streamNoteDir = '';

    rimraf.sync(__dirname + `/tmp/${this.repoDirectory}`);
  };

  private async onStreamNoteRebuild(streamDate: string) {
    if (streamDate) {
      // this.buildStreamNotes(streamDate);
      this.buildJSON();
    }
  }

  private async buildJSON() {
    let streams: IStream[] | undefined = await this.streamDb.getAllStreams();

    if (streams && streams.length) {
      log('info', `Building stream notes for ${streams.length} streams`);

      await this.initGit()
        .then(this.clone)
        .then(this.configureGit)
        .then(this.branch);

      for (let i = 0; i < streams.length; i++) {
        this.activeStream = streams[i];

        if (this.activeStream) {
          this.streamNoteName = moment(this.activeStream.started_at).format(
            'YYYY-MM-DD'
          );

          this.streamNoteDir = `/_streams/${moment(
            this.activeStream.started_at
          ).format('YYYY/MM')}/`;

          await this.generateJSONFile();
        }
      }

      await this.add()
        .then(this.commit)
        .then(this.push)
        .catch((err: any) => log('info', `buildStreamNotes: ${err}`))
        .finally(this.cleanUp);
    }
  }
}
