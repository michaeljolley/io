import io from 'socket.io-client';
// tslint:disable-next-line: no-var-requires
const TwitchWebhook = require('twitch-webhook');

import { NGrok } from './ngrok';

import { config, get, log } from '@shared/common';
import { IBaseEventArg, INewFollowerEventArg, IStreamEventArg } from '@shared/event_args';
import { IUserInfo, IStream } from '@shared/models';

export class WebHook {
  private socket!: SocketIOClient.Socket;
  private ngrok: NGrok;
  private activeStream: IStream | undefined;
  private twitchFollowerWebhook: any;

  constructor() {
    this.socket = io('http://hub');
    this.ngrok = new NGrok();

    this.socket.on('streamStart', (streamEvent: IStreamEventArg) =>
      this.onStreamStart(streamEvent)
    );
    this.socket.on('streamUpdate', (streamEvent: IStreamEventArg) =>
      this.onStreamUpdate(streamEvent)
    );
    this.socket.on('streamEnd', (streamEvent: IStreamEventArg) =>
      this.onStreamEnd(streamEvent)
    );

    // Unsubscribe from Webhooks
    // otherwise it will try to send events to a down app
    process.on('SIGINT', () => {
      log('info', "I'm going bye-bye");
      this.unregisterWebhooks();
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

  private async connectTwitchFollowersWebhook() {

    this.ngrok.getUrl()
        .then((ngrokUrl: string) => {
          log('info', `Received ${ngrokUrl} from nGrok`);

          this.twitchFollowerWebhook = new TwitchWebhook({
            callback: `${ngrokUrl}`,
            client_id: config.twitchClientId,
            lease_seconds: 43200, // 12 hours
            listen: {
              port: 80
            }
          });

          this.twitchFollowerWebhook.on('users/follows', async (event: any) => {
            log('info', JSON.stringify(event));

            if (this.activeStream &&
                event &&
                event.data &&
                event.data.length > 0) {

                const followerUserName: string = event.data[0].from_name || '';

                const follower: IUserInfo | undefined = await this.getUser(followerUserName);

                if (follower) {
                  const followerEvent: INewFollowerEventArg = {
                    follower,
                    streamId: this.activeStream.id
                  };

                  this.emitMessage('newFollow', followerEvent);
                }
            }
          });

          this.twitchFollowerWebhook.subscribe('users/follows', {
            first: 1,
            from_id: config.twitchClientUserId // ID of Twitch Channel
          });

          // renew the subscription when it expires
          this.twitchFollowerWebhook.on('unsubscibe', (obj: any) => {
            this.twitchFollowerWebhook.subscribe(obj['hub.topic']);
          });
        })
        .catch((err: any) => {
          log('info', err);
        });
  }

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
