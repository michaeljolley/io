import io from 'socket.io-client';
// tslint:disable-next-line: no-var-requires
const TwitchWebhook = require('twitch-webhook');

import { config,  log,  } from '@shared/common';
import { IStreamEventArg,  } from '@shared/event_args';
import { IStream,  } from '@shared/models';
import { SocketIOEvents } from '@shared/events';
import { NGrok } from './ngrok';

export class WebHook {
  private socket!: SocketIOClient.Socket;
  private activeStream: IStream | undefined;
  private twitchFollowerWebhook: any;
  private ngrok: NGrok;

  constructor() {
    this.socket = io('http://hub');
    this.ngrok = new NGrok();

    this.socket.on(SocketIOEvents.StreamStarted, (streamEvent: IStreamEventArg) =>
      this.onStreamStart(streamEvent)
    );
    this.socket.on(SocketIOEvents.StreamUpdated, (streamEvent: IStreamEventArg) =>
      this.onStreamUpdate(streamEvent)
    );
    this.socket.on(SocketIOEvents.StreamEnded, (streamEvent: IStreamEventArg) =>
      this.onStreamEnd(streamEvent)
    );

    this.socket.on(SocketIOEvents.OnChatMessage, this.twitchFollowerWebhook);

    // Unsubscribe from Webhooks
    // otherwise it will try to send events to a down app
    process.on('SIGINT', () => {
      log('info', "I'm going bye-bye");
      this.unregisterWebhooks();
      process.exit(0);
    });

    // Whever NODEMON restarts our node process
    // We need to kill NGROK otherwise the inspect web doesn't shutdown
    process.on('SIGUSR2', () => {
      log('info', "I'm reloading!");
      this.unregisterWebhooks();
      this.ngrok.kill();
      process.exit(0);
    });
  }

  // tslint:disable-next-line: no-empty
  public go() {
  }

  private onStreamStart(streamEvent: IStreamEventArg) {
    log('info', `onStreamStart: ${JSON.stringify(streamEvent.stream.id)}`);
    this.activeStream = streamEvent.stream;

    this.connectTwitchFollowersWebhook();
  }

  private onStreamUpdate(streamEvent: IStreamEventArg) {
    log('info', `onStreamUpdate: ${JSON.stringify(streamEvent.stream.id)}`);

    if (this.activeStream === undefined) {
      this.activeStream = streamEvent.stream;

      this.connectTwitchFollowersWebhook();
    }
  }

  private onStreamEnd(streamEvent: IStreamEventArg) {
    log('info', `onStreamEnd: ${JSON.stringify(streamEvent.stream.id)}`);
    this.activeStream = undefined;
    // TODO: End all webhook subscriptions
    if (this.twitchFollowerWebhook) {
      this.twitchFollowerWebhook.unsubscribe('users/follows', {
        first: 1,
        to_id: config.twitchClientUserId
      });
    }
  }

  private unregisterWebhooks() {
    if (this.twitchFollowerWebhook) {
      this.twitchFollowerWebhook.unsubscribe('users/follows', {
        first: 1,
        to_id: config.twitchClientUserId
      });
    }
  }

  private connectTwitchFollowersWebhook() {

      this.ngrok.getUrl()
      .then((ngrokUrl: string) => {
          log('info', ngrokUrl);

          this.twitchFollowerWebhook = new TwitchWebhook({
            callback: `${ngrokUrl}`,
            client_id: config.twitchClientId,
            lease_seconds: 43200, // 12 hours
            listen: {
              port: 8800
            }
          });

          this.twitchFollowerWebhook.on('users/follows', async (payload: any) => {
            log('info',JSON.stringify(payload));
          });

          this.twitchFollowerWebhook.subscribe('users/follows', {
            first: 1,
            to_id: config.twitchClientUserId // ID of Twitch Channel
          });

          // renew the subscription when it expires
          this.twitchFollowerWebhook.on('unsubscribe', (obj: any) => {
            this.twitchFollowerWebhook.subscribe(obj['hub.topic']);
          });
        })
      .catch((err: any) => {
        log('info', err);
      });
  }

  // private handleFollow = async (payload: any) : Promise<void> => {
  //   log('info', JSON.stringify(payload));

  //   const event = payload.event;

  //   if (this.activeStream &&
  //       event &&
  //       event.data &&
  //       event.data.length > 0) {

  //       const followerUserName: string = event.data[0].from_name || '';

  //       const follower: IUserInfo | undefined = await this.getUser(followerUserName);

  //       if (follower) {
  //         const followerEvent: INewFollowerEventArg = {
  //           follower,
  //           streamId: this.activeStream.id
  //         };

  //         this.emitMessage('newFollow', followerEvent);
  //       }
  //   }
  // }

  // private getUser = async (
  //   username: string
  // ): Promise<IUserInfo | undefined> => {
  //   const url = `http://user/users/${username}`;

  //   return await get(url).then((user: any) => {
  //     if (user) {
  //       return user;
  //     }
  //     return undefined;
  //   });
  // };

  // private emitMessage = (event: string, payload: IBaseEventArg) => {
  //   if (!this.socket.disconnected) {
  //     this.socket.emit(event, payload);
  //   }
  // };
}
