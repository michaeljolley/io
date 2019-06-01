import { Client, ChatUserstate, Userstate } from 'tmi.js';
import io from 'socket.io-client';
import sanitizeHtml from 'sanitize-html';

import { config, get, log } from './common';
import { Emote } from './emote';

const htmlSanitizeOpts = {
  allowedAttributes: {},
  allowedTags: [
    'h1','h2','h3','h4','h5','h6',
    'marquee','em','strong','b','i','code',
    'blockquote','strike'
  ]
};

export class TwitchChat {
  public tmi: Client;
  private clientUsername: string = config.twitchClientUsername;
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

  /**
   * Sends message to Twitch chat
   * @param message message to send
   */
  public sendChatMessage(message: string) {
    // Default to first channel in connected channels
    this.tmi.say(config.twitchClientUsername, message);
  }

  /**
   * Set the options for the twitch bot
   */
  private setTwitchChatOptions = (): {} => {
    const channels = [config.twitchClientUsername];

    return {
      channels,
      connection: {
        reconnect: true,
        secure: true
      },
      identity: {
        password: config.twitchBotToken,
        username: this.clientUsername
      },
      options: {
        debug: true
      }
    };
  };

  /**
   * When a user joins the channel
   */
  private onUserJoined = async (channel: string, username: string, self: boolean) => {
    const { hours, minutes } = this.getTime();

    // Identify user and add to user state if needed
    await this.getUser(username);

    log('info', `[${hours}:${minutes}] ${username} has JOINED the channel`);
    this.emitMessage('userJoined', username);

    if (self) {
      log('info', 'This client joined the channel...');
      // Assume first channel in channels array is 'self' - owner monitoring their own channel
      setTimeout(this.pingTtv, 30000);
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

  /**
   * When a user raids the channel
   */
  private onRaid = async (channel: string, username: string, viewers: number) => {
    const { hours, minutes } = this.getTime();

    // Identify user and add to user state if needed
    const userInfo = await this.getUser(username);

    this.emitMessage('newRaid', username, userInfo, viewers);

    log('info', `[${hours}:${minutes}] ${username} has RAIDED the channel with ${viewers} viewers`);
  }

  /**
   * When a user cheers
   */
  private onCheer = async (channel: string, user: Userstate, message: string) => {
    const { hours, minutes } = this.getTime();

    const username: string = user.username ? user.username : '';

    // Identify user and add to user state if needed
    const userInfo = await this.getUser(username);

    this.emitMessage('newCheer', user, userInfo, message);

    const bits = user.bits;

    log('info', `[${hours}:${minutes}] ${user.username} cheered ${bits} bits`);
  }

  private onGiftSubRenew = async (channel: string, username: string, sender: string, user: Userstate) => {
    await this.onAnySub(user, true, true, '');
  }

  private onAnonymousGiftSubRenew = async (channel: string, username: string, user: Userstate) => {
    await this.onAnySub(user, true, true, '');
  }

  private onGiftSub = async (channel: string, username: string, streakMonths: number, recipient: string, methods: any, user: Userstate) => {
    await this.onAnySub(user, false, true, '');
  }

  private onGiftMysterySub = async (channel: string, username: string, numberOfSubs: number, methods: any, user: Userstate) => {
    await this.onAnySub(user, false, true, '');
  }

  private onResub = async (channel: string, username: string, streakMonths: number, message: string, user: Userstate, methods: any) => {
    await this.onAnySub(user, true, false, message);
  }

  private onSub = async (channel: string, username: string, methods: any, message: string, user: Userstate) => {
    await this.onAnySub(user, false, false, message);
  }

  private onAnySub = async (user: Userstate, isRenewal: boolean, wasGift: boolean, message: string) => {
    const { hours, minutes } = this.getTime();

    const username: string = user.username ? user.username : '';

    // Identify user and add to user state if needed
    const userInfo = await this.getUser(username);

    this.emitMessage('newSubscription', user, userInfo, isRenewal, wasGift, message);

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

    this.emitMessage('chatMessage', { user, message, userInfo });
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

    let tempMessage: string = sanitizeHtml(message, htmlSanitizeOpts);

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

        this.emitMessage('emote', emote.emoteUrl);

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
