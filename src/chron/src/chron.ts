import io from 'socket.io-client';

import { get, log } from './common';

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
    setInterval(async () => { await this.broadcastFollowers(); }, 60000);

    // Every minute get the current viewer count
    setInterval(async () => { await this.broadcastViewCount(); }, 60000);

    // Every minute get the latest subscriber
    setInterval(async () => { await this.broadcastLastSubscriber(); }, 60000);

    log('info', 'Chron is online and running...');
  }

  public broadcastFollowers = async () : Promise<any> => {
    const url = `${this.apiUrl}/followers`;

    const resp = await get(url).then((data: any) => data);

    const followerCount: number = resp.total;
    const lastFollower: any = await this.getUser(resp.data[0].from_name);

    this.emitMessage('followerCount', followerCount);
    this.emitMessage('lastFollower', lastFollower);

    log('info', `Broadcast last follower: ${lastFollower.login} | follower count: ${followerCount}`);
    return;
  }

  public broadcastViewCount = async () : Promise<any> => {
    const url = `${this.apiUrl}/stream`;
    let viewerCount: number = 0;

    const resp = await get(url).then((data: any) => data);
    if (resp !== undefined) {
      viewerCount = resp.viewer_count !== undefined ? resp.viewer_count : 0;

      // stream ended
      if (resp.started_at === undefined && this.activeStream !== undefined) {
        this.emitMessage('streamEnd', this.activeStream.id);
        this.activeStream = undefined;
        log('info', `Stream ended`);
      }

      // stream started
      if (resp.started_at !== undefined && this.activeStream === undefined) {
        this.activeStream = resp;
        this.emitMessage('streamStart', this.activeStream);
        log('info', `Stream started: ${JSON.stringify(this.activeStream)}`);
      }

    }
    else {
      viewerCount = 0;
      this.activeStream = undefined;
    }

    log('info', `Viewer count: ${viewerCount}`);
    this.emitMessage('viewerCount', viewerCount);
  }

  public broadcastLastSubscriber = async () : Promise<any> => {
    const url = `${this.apiUrl}/subscribers`;

    const resp = await get(url).then((data: any) => data);
    const lastRecord = resp.length - 1;
    const lastSub = resp[lastRecord];

    const lastSubscriber = await this.getUser(lastSub.user_name);

    this.emitMessage('lastSubscriber', lastSubscriber);

    log('info', `Broadcast last subscriber: ${lastSubscriber.login}`);
    return;
  }

  // socket.on('subscriberCount', (subscriberCount: number) => this.onSubscriberCount(subscriberCount));

  private getUser = async (username: string): Promise<any> => {
    const url = `http://user/users/${username}`;

    return await get(url).then((user: any) => {
      return user;
    });
  };

  private emitMessage = (event: string, ...payload: any[]) => {
    if (!this.socket.disconnected) {
      this.socket.emit(event, payload);
    }
  }
}
