import { Client, ChatUserstate, Userstate } from 'tmi.js';
import io from 'socket.io-client';

import { log } from './log';
import * as restler from 'restler';
import { Emote } from './emote';
import { APIResponse } from './api-response';

export class TwitchChat {
  public tmi: Client;
  private clientUsername: string = 'theMichaelJolley';
  private moderators: string[] = ['theMichaelJolley'];
  private socket!: SocketIOClient.Socket;

  constructor() {
    this.tmi = Client(this.setTwitchChatOptions());
    this.socket = io('http://hub');

    // Chatroom events
    this.tmi.on('join', this.onUserJoined);
    this.tmi.on('part', this.onUserLeft);
    this.tmi.on('chat', this.onChatMessage);

    // Alert events
    this.tmi.on('raided', this.onRaid);
    this.tmi.on('cheer', this.onCheer);

    // Sub related alert events
    this.tmi.on('anongiftpaidupgrade', this.onAnonymousGiftSubRenew);
    this.tmi.on('giftpaidupgrade', this.onGiftSubRenew);
    this.tmi.on('resub', this.onResub);
    this.tmi.on('subgift', this.onGiftSub);
    this.tmi.on('submysterygift', this.onGiftMysterySub);
    this.tmi.on('subscription', this.onSub);
  }

  /**
   * Connect to the TTV Chat Client
   */
  public connect = () => {
    log('info', 'Client is online and running...');
    this.tmi.connect();
  };

  /**
   * Ping twitch
   */
  public pingTtv = () => {
    this.tmi.ping();
  };

  public sendChatMessage(message: string) {
    // Default to first channel in connected channels
    this.tmi.say('theMichaelJolley', message);
  }

  /**
   * Set the options for the twitch bot
   */
  private setTwitchChatOptions = (): {} => {
    const channels = ['theMichaelJolley'];

    return {
      channels,
      connection: {
        reconnect: true,
        secure: true
      },
      identity: {
        password: 'oauth:mqldn8rzzboiufj9qk6ursujhqsvtu',
        username: this.clientUsername
      },
      options: {
        // clientId: ttvClientId,
        debug: true
      }
    };
  };

  /**
   * When a user joins the channel
   */
  private onUserJoined = (channel: string, username: string, self: boolean) => {
    const { hours, minutes } = this.getTime();
    const channels = ['theMichaelJolley'];

    log('info', `[${hours}:${minutes}] ${username} has JOINED the channel`);
    this.emitMessage('userJoined', username);

    if (self) {
      log('info', 'This client joined the channel...');
      // Assume first channel in channels array is 'self' - owner monitoring their own channel
      setTimeout(this.pingTtv, 30000);
      this.tmi
        .mods(channels[0])
        .then((modsFromTwitch: any) => {
          this.moderators = this.moderators.concat(modsFromTwitch);
        })
        .catch((error: any) =>
          log('error', `There was an error getting moderators: ${error}`)
        );
    }
  };

  /**
   * When a user leaves the channel
   */
  private onUserLeft = (channel: string, username: string) => {
    const { hours, minutes } = this.getTime();

    this.emitMessage('userLeft', username);

    log('info', `[${hours}:${minutes}] ${username} has LEFT the channel`);
  };

  private onRaid = (channel: string, username: string, viewers: number) => {
    const { hours, minutes } = this.getTime();

    this.emitMessage('newRaid', username);

    log('info', `[${hours}:${minutes}] ${username} has RAIDED the channel with ${viewers} viewers`);
  }

  private onCheer = (channel: string, user: Userstate, message: string) => {
    const { hours, minutes } = this.getTime();

    this.emitMessage('newCheer', user.username);

    const bits = user.bits;

    log('info', `[${hours}:${minutes}] ${user.username} cheered ${bits} bits`);
  }

  private onGiftSubRenew = (channel: string, username: string, sender: string, user: Userstate) => {
    this.onAnySub(user, true, true);
  }

  private onAnonymousGiftSubRenew = (channel: string, username: string, user: Userstate) => {
    this.onAnySub(user, true, true);
  }

  private onGiftSub = (channel: string, username: string, streakMonths: number, recipient: string, methods: any, user: Userstate) => {
    this.onAnySub(user, false, true);
  }

  private onGiftMysterySub = (channel: string, username: string, numberOfSubs: number, methods: any, user: Userstate) => {
    this.onAnySub(user, false, true);
  }

  private onResub = (channel: string, username: string, streakMonths: number, message: string, user: Userstate, methods: any) => {
    this.onAnySub(user, true, false);
  }

  private onSub = (channel: string, username: string, methods: any, message: string, user: Userstate) => {
    this.onAnySub(user, false, false);
  }

  private onAnySub(user: Userstate, isRenewal: boolean, wasGift: boolean) {
    const { hours, minutes } = this.getTime();

    this.emitMessage('newSubscription', user, isRenewal, wasGift);

    log('info', `[${hours}:${minutes}] ${user.username} subscribed`);
  }

  /**
   * When a user sends a message in chat
   */
  private onChatMessage = async (channel: string, user: ChatUserstate, message: string): Promise<any> => {
    log('info', message);

    // Parse chat for any commands & update
    // message for display in overlays
    message = this.processChatMessage(message, user);

    const username: string = user.username ? user.username : '';

    // Identify user and pass along to hub
    const userInfo = await this.getUser(username);

    this.emitMessage('chatMessage', {user, message, userInfo});
  };

  private getTime() {
    const date = new Date();
    const rawMinutes = date.getMinutes();
    const rawHours = date.getHours();
    const hours = (rawHours < 10 ? '0' : '') + rawHours.toLocaleString();
    const minutes = (rawMinutes < 10 ? '0' : '') + rawMinutes.toLocaleString();
    return { hours, minutes };
  };

  /**
   * This weeds through the trolls and deciphers if the message is something that we want to do
   * something about
   *
   * @param message the message sent by a user
   * @param user the user who sent the message
   */
  private processChatMessage = (message: string, user: ChatUserstate): string => {

    let tempMessage: string = message;

    // If the message has emotes, modify message to include img tags to the emote
    if (user.emotes) {
      let emoteSet: Emote[] = [];

      for (const emote of Object.keys(user.emotes)) {
        const emoteLocations = user.emotes[emote];
        emoteLocations.forEach(location => {
          emoteSet.push(new Emote(emote, location));
        });
      }

      // Order the emotes descending so we can iterate
      // through them with indexes
      emoteSet = emoteSet.sort((a, b) => {
        return b.end - a.end;
      });

      emoteSet.forEach(emote => {
        let emoteMessage = tempMessage.slice(0, emote.start);
        emoteMessage += emote.emoteImageTag;
        emoteMessage += tempMessage.slice(emote.end + 1, tempMessage.length);
        tempMessage = emoteMessage;
      });
    }

    return tempMessage;
  };

  private getUser = async (username: string): Promise<any> => {
    const url = `http://user/users/${username}`;

    return await this.get(url).then((user: any) => {
      return user;
    });
  };

  private get = (url: string) => {
    return new Promise((resolve, reject) => {
        restler.get(url, {
            headers: {
                "Client-ID": 'nf56rsp3y60xsj86p5pm6wqagil1ta',
                "Content-Type": "application/json"
            }
        }).on("complete", (data: any) => {
            resolve(data);
        });
    });
  }

  private emitMessage = (event: string, ...payload: any[]) => {
    if (!this.socket.disconnected) {
      this.socket.emit(event, payload);
    }
  }
}
