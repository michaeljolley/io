import io from 'socket.io-client';

import { SocketIOEvents } from '@shared/events';
import { get, post, log, config } from '@shared/common';
import { IGitHubRepo, IUserInfo, ILiveCodersTeam, ILiveCodersTeamMember } from '@shared/models';
import { IBaseEventArg, ILastUserEventArg, IViewerCountEventArg, IStreamEventArg, IFollowerCountEventArg, INewAnnouncementEventArg } from '@shared/event_args';

export class Chron {
  private socket!: SocketIOClient.Socket;
  private apiUrl: string = 'http://api';
  private repoUrl: string = `${this.apiUrl}/repos/`;

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
    this.loadLiveTeamMembers();
    this.refreshRepos();

    // Every day update our repos
    setInterval(async () => {
      await this.refreshRepos();
    }, 86400000);

    // Every week update the live coders team members;
    setInterval(async() => {
      await this.loadLiveTeamMembers();
    }, 604800000);

    // Every minute get the latest follower and follower count
    setInterval(async () => {
      await this.broadcastFollowers();
    }, 60000);

    // Every  minutes, announce that viewers can use !help to learn more about the commands
    // available in chat
    setInterval(async () => {
      await this.broadcastAnnouncement("New here? You can type '!help' in chat to see what commands are available.");
    }, 330000);

    // Every  minutes, announce that viewers can use !theme to change the theme of VS Code
    setInterval(async () => {
      await this.broadcastAnnouncement("Change my VS Code theme. Type '!theme help' in chat to learn how.");
    }, 540000);

    // Every  minutes, announce that viewers can use !sfx to find out what sound effects they can control
    // from chat
    setInterval(async () => {
      await this.broadcastAnnouncement("Want to play a sound? Type '!sfx' in chat to see what's available.");
    }, 720000);

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

  private refreshRepos = async (): Promise<void> => {
    const resp: IGitHubRepo[] = await get(this.repoUrl).then((response: any) => response.data as IGitHubRepo[]);
    if (resp.length > 0) {
      const url = `http://repo/refresh`;
      await post(url, resp);
    }
  }

  public loadLiveTeamMembers = async (): Promise<any> => {
    const url = `${this.apiUrl}/team/livecoders`;

    const resp: ILiveCodersTeam = await get(url).then((data: any) => data as ILiveCodersTeam);

    const liveCodersTeamMembers: ILiveCodersTeamMember[] = resp.users;

    if (liveCodersTeamMembers) {
      await this.updateLiveCoders(liveCodersTeamMembers.map(member => member.name));
    }
  }

  public broadcastFollowers = async (): Promise<any> => {
    const url = `${this.apiUrl}/followers`;

    const resp = await get(url).then((data: any) => data);

    const followerCount: number = resp.total;

    const followerCountEventArg: IFollowerCountEventArg = {
      followers: followerCount
    };

    this.emitMessage(SocketIOEvents.FollowerCountChanged, followerCountEventArg);

    if (resp.total > 0 && resp.data[0].from_name) {
      const lastFollower: IUserInfo | undefined = await this.getUser(
        resp.data[0].from_name
      );

      if (lastFollower) {
        const lastFollowerEventArg: ILastUserEventArg = {
          userInfo: lastFollower
        };

        this.emitMessage(SocketIOEvents.LastFollowerUpdated, lastFollowerEventArg);
      }
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
        this.emitMessage(SocketIOEvents.StreamEnded, streamEventArg);
        this.activeStream = undefined;
        log('info', `Stream ended: ${this.activeStream.id}`);
      }

      // stream started
      if (resp.started_at !== undefined && this.activeStream === undefined) {
        this.activeStream = resp;
        streamEventArg.stream = this.activeStream;
        this.emitMessage(SocketIOEvents.StreamStarted, streamEventArg);
        log('info', `Stream started: ${this.activeStream.id}`);
      }

      if (this.activeStream) {
        this.emitMessage(SocketIOEvents.StreamUpdated, streamEventArg);
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

    this.emitMessage(SocketIOEvents.ViewerCountChanged, viewCountEventArg);
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
        this.emitMessage(SocketIOEvents.LastSubscriberUpdated, lastSubEventArg);
      }
    }

    return;
  };

  private broadcastAnnouncement = async (message: string) : Promise<any> => {

    const user = await this.getUser(config.twitchBotUsername);

    if (user) {
      const newAnnouncementEventArg: INewAnnouncementEventArg = {
        message,
        user
      };

      this.emitMessage(SocketIOEvents.NewAnnouncement, newAnnouncementEventArg);
    }
  }

  private updateLiveCoders = async (
    usernames: string[]
  ): Promise<void> => {
    const url = `http://user/livecoders`;
    await post(url, usernames);
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
