import io from 'socket.io-client';
import fs from 'fs';
import moment from 'moment';
import rimraf from 'rimraf';
import simplegit from 'simple-git/promise';

import { config, log } from '@shared/common';
import {
  IStreamEventArg
} from '@shared/event_args';
import { StreamDb } from '@shared/db';
import { IStream } from '@shared/models';
import { SocketIOEvents } from '@shared/events';

import { Markdowner } from './markdowner';

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

    this.socket.on(SocketIOEvents.StreamEnded, (streamEvent: IStreamEventArg) => this.onStreamEnd(streamEvent));
    this.socket.on(SocketIOEvents.StreamNoteRebuild, (streamId: string) => this.onStreamNoteRebuild(streamId));
  }

  /**
   * Start stream notes processes
   */
  public start() {
    log('info', 'Stream Notes is online and running...');
  }

  private initGit = async () : Promise<any> => {
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
  }

  private configureGit = async () : Promise<any> => {

    return await new Promise((resolve: any, reject: any) => {

      this.git.addConfig('user.name', config.githubName).then((val: string) => {
        this.git.addConfig('user.email', config.githubEmailAddress).then((val2: string) => {
          log('info', 'git configured');
          resolve(true);
        }).catch((err: any) => {
          log('info', `configureGet: ERR: ${err}`);
          reject(err);
        });
      }).catch((err: any) => {
        log('info', `configureGet: ERR: ${err}`);
        reject(err);
      });
    });
  }

  private clone = async () : Promise<any> => {
    return await new Promise((resolve: any, reject: any) => {
      this.git.clone(this.gitHubRepoUrl, __dirname + `/tmp/${this.repoDirectory}`).then((value: string) => {
        log('info', `Successfully cloned ${config.githubUsername}/${config.githubRepo}`);

        resolve(value);
      }).catch((err: any) => {
        reject(err);
      });
    });
  }

  private branch = async () : Promise<any> => {
    return await new Promise((resolve: any, reject: any) =>
      this.git.checkoutLocalBranch(this.streamNoteName).then(() => {
        log('info', `Successfully checked out ${this.streamNoteName}`);
        resolve(this.streamNoteName);
      }).catch((err: any) => {
        reject(err);
      })
    );
  }

  private add = async () : Promise<any> => {
    return await new Promise((resolve: any, reject: any) =>
      this.git.add('./*').then(() => {
        log('info', `Successfully added file ${this.streamNoteName}.md`);
        resolve(this.streamNoteName);
      }).catch((err: any) => {
        reject(err);
      })
    );
  }

  private commit = async () : Promise<any> => {
    return await new Promise((resolve: any, reject: any) =>
      this.git.commit(`Adding stream notes for ${this.streamNoteName}`).then(() => {
        log('info', `Successfully committed file ${this.streamNoteName}.md`);
        resolve(this.streamNoteName);
      }).catch((err: any) => {
        reject(err);
      })
    );
  }

  private push = async () : Promise<any> => {
    return await new Promise((resolve: any, reject: any) =>
      this.git.push(this.gitHubRepoUrl, this.streamNoteName).then(() => {
        log('info', `Successfully pushed branch: ${this.streamNoteName}`);
        resolve(this.streamNoteName);
      }).catch((err: any) => {
        reject(err);
      })
    );
  }

  private generateStreamNotesFile = async () : Promise<any> => {
    return await new Promise((resolve: any, reject: any) => {
      const markdowner = new Markdowner(this.activeStream);
      markdowner.generateMarkdown().then((content: string) => {
        fs.writeFileSync(__dirname + `/tmp/${this.repoDirectory}/${this.streamNoteDir}${this.streamNoteName}.md`, content);
        log('info', `Stream notes added to '${__dirname}/tmp/${this.repoDirectory}/${this.streamNoteDir}${this.streamNoteName}.md'!`);
        resolve(this.streamNoteName);
      });
    });
  }

  private cleanUp = () => {
    this.activeStream = undefined;
    this.streamNoteName = '';
    this.streamNoteDir = '';

    rimraf.sync(__dirname + `/tmp/${this.repoDirectory}`);
  }

  private async onStreamEnd(streamEvent: IStreamEventArg) {
    if (streamEvent && streamEvent.stream) {
      this.buildStreamNotes(streamEvent.stream.id);
    }
  }

  private async onStreamNoteRebuild(streamId: string) {
    if (streamId) {
      this.buildStreamNotes(streamId);
    }
  }

  private async buildStreamNotes(streamId: string) {

    // Get the stream from the streamDb (include users/candles/etc)
    this.activeStream = await this.streamDb.getStream(streamId);

    if (this.activeStream) {

      log('info', `Building stream notes for ${this.activeStream.id}`);

      if (this.activeStream) {
        this.streamNoteName = moment(this.activeStream.started_at).format('YYYY-MM-DD');
        this.streamNoteDir = `docs/_posts/${moment(this.activeStream.started_at).format('YYYY/MM')}/`;

        // Clone our BBB repo
        await this.initGit()
                    .then(this.clone)
                    .then(this.configureGit)
                    .then(this.branch)
                    .then(this.generateStreamNotesFile)
                    .then(this.add)
                    .then(this.commit)
                    .then(this.push)
                    .catch((err: any) => log('info', `buildStreamNotes: ${err}`))
                    .finally(this.cleanUp);

      }
    }
  }
}
