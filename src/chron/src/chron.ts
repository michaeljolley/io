import io from 'socket.io-client';

import { get, log } from './common';
import { IUserInfo } from './models';
import { IBaseEventArg, ILastUserEventArg, IViewerCountEventArg, IStreamEventArg, IFollowerCountEventArg } from './event_args';

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

    const followerCountEventArg: IFollowerCountEventArg = {
      followers: followerCount
    };

    this.emitMessage('followerCount', followerCountEventArg);

    if (lastFollower) {
      const lastFollowerEventArg: ILastUserEventArg = {
        userInfo: lastFollower
      };

      this.emitMessage('lastFollower', lastFollowerEventArg);
    }
    return;
  };

  public broadcastViewCount = async (): Promise<any> => {
    const url = `${this.apiUrl}/stream`;
    let viewerCount: number = 0;

    const resp = await get(url).then((data: any) => data);
    if (resp !== undefined) {
      viewerCount = resp.viewer_count !== undefined ? resp.viewer_count : 0;

      const streamEventArg: IStreamEventArg = {
        stream: this.activeStream
      };

      // stream ended
      if (resp.started_at === undefined && this.activeStream !== undefined) {
        this.emitMessage('streamEnd', streamEventArg);
        this.activeStream = undefined;
        log('info', `Stream ended: ${this.activeStream.id}`);
      }

      // stream started
      if (resp.started_at !== undefined && this.activeStream === undefined) {
        this.activeStream = resp;
        streamEventArg.stream = this.activeStream;
        this.emitMessage('streamStart', streamEventArg);
        log('info', `Stream started: ${this.activeStream.id}`);
      }

      if (this.activeStream) {
        this.emitMessage('streamUpdate', streamEventArg);
        log('info', `Stream update: ${this.activeStream.id}`);
      }
    } else {
      viewerCount = 0;
      this.activeStream = undefined;
    }

    log('info', `Viewer count: ${viewerCount}`);

    const viewCountEventArg: IViewerCountEventArg = {
      viewers: viewerCount
    };

    this.emitMessage('viewerCount', viewCountEventArg);
  };

  public broadcastLastSubscriber = async (): Promise<any> => {
    const url = `${this.apiUrl}/subscribers/last`;

    const lastSub = await get(url).then((data: any) => data);

    log('info', JSON.stringify(lastSub));

    const lastSubscriber: IUserInfo | undefined = await this.getUser(
      lastSub
    );
    if (lastSubscriber) {
      const lastSubEventArg: ILastUserEventArg = {
        userInfo: lastSubscriber
      };

      if (lastSubscriber) {
        this.emitMessage('lastSubscriber', lastSubEventArg);
      }
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

  private emitMessage = (event: string, payload: IBaseEventArg) => {
    if (!this.socket.disconnected) {
      this.socket.emit(event, payload);
    }
  };
}
