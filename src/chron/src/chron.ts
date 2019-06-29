import io from 'socket.io-client';

import { get, log } from './common';
import { IUserInfo } from './models';

export class Chron {
  private socket!: SocketIOClient.Socket;
  private apiUrl: string = 'http://api';

  private activeStream: any | undefined;

  constructor() {
    this.socket = io('http://hub');
  }

  /**
   * Start chron processes
   */
  public start() {
    this.broadcastFollowers();
    this.broadcastViewCount();
    this.broadcastLastSubscriber();

    // Every minute get the latest follower and follower count
    setInterval(async () => {
      await this.broadcastFollowers();
    }, 60000);

    // Every minute get the current viewer count
    setInterval(async () => {
      await this.broadcastViewCount();
    }, 60000);

    // Every minute get the latest subscriber
    setInterval(async () => {
      await this.broadcastLastSubscriber();
    }, 60000);

    log('info', 'Chron is online and running...');
  }

  public broadcastFollowers = async (): Promise<any> => {
    const url = `${this.apiUrl}/followers`;

    const resp = await get(url).then((data: any) => data);

    const followerCount: number = resp.total;

    const lastFollower: IUserInfo | undefined = await this.getUser(
      resp.data[0].from_name
    );

    this.emitMessage('followerCount', followerCount);

    if (lastFollower) {
      this.emitMessage('lastFollower', lastFollower);
    }
    return;
  };

  public broadcastViewCount = async (): Promise<any> => {
    const url = `${this.apiUrl}/stream`;
    let viewerCount: number = 0;

    const resp = await get(url).then((data: any) => data);
    if (resp !== undefined) {
      viewerCount = resp.viewer_count !== undefined ? resp.viewer_count : 0;

      // stream ended
      if (resp.started_at === undefined && this.activeStream !== undefined) {
        this.emitMessage('streamEnd', this.activeStream);
        this.activeStream = undefined;
        log('info', `Stream ended: ${this.activeStream.id}`);
      }

      // stream started
      if (resp.started_at !== undefined && this.activeStream === undefined) {
        this.activeStream = resp;
        this.emitMessage('streamStart', this.activeStream);
        log('info', `Stream started: ${this.activeStream.id}`);
      }

      if (this.activeStream) {
        this.emitMessage('streamUpdate', this.activeStream);
        log('info', `Stream update: ${this.activeStream.id}`);
      }
    } else {
      viewerCount = 0;
      this.activeStream = undefined;
    }

    log('info', `Viewer count: ${viewerCount}`);
    this.emitMessage('viewerCount', viewerCount);
  };

  public broadcastLastSubscriber = async (): Promise<any> => {
    const url = `${this.apiUrl}/subscribers`;

    const resp = await get(url).then((data: any) => data);
    const lastRecord = resp.length - 1;
    const lastSub = resp[lastRecord];

    const lastSubscriber: IUserInfo | undefined = await this.getUser(
      lastSub.user_name
    );

    if (lastSubscriber) {
      this.emitMessage('lastSubscriber', lastSubscriber);
    }

    return;
  };

  private getUser = async (
    username: string
  ): Promise<IUserInfo | undefined> => {
    const url = `http://user/users/${username}`;

    return await get(url).then((user: any) => {
      if (user) {
        return user;
      }
      return undefined;
    });
  };

  private emitMessage = (event: string, ...payload: any[]) => {
    if (!this.socket.disconnected) {
      this.socket.emit(event, payload);
    }
  };
}
