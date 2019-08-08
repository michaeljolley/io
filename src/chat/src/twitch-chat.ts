import {
  Client,
  ChatUserstate,
  Userstate,
  SubGiftUserstate,
  SubUserstate
} from 'tmi.js';
import io from 'socket.io-client';
import sanitizeHtml from 'sanitize-html';

import { IUserInfo, ISubscriber, IRaider, ICheer, IStream } from '@shared/models';
import { config, get, log, isMod, isBroadcaster } from '@shared/common';
import { SocketIOEvents } from '@shared/events';
import { IEmoteEventArg, IChatMessageEventArg, INewSubscriptionEventArg, INewCheerEventArg, INewRaidEventArg, IUserLeftEventArg, IUserJoinedEventArg, IBaseEventArg, IStreamEventArg, ICandleWinnerEventArg, IUserEventArg } from '@shared/event_args';

import { Emote } from './emote';

import {
  AVCommands,
  BasicCommands,
  CandleCommands,
  NoteCommands,
  StreamCommands,
  UserCommands
} from './commands';

const htmlSanitizeOpts = {
  allowedAttributes: {},
  allowedTags: [
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'marquee',
    'em',
    'strong',
    'b',
    'i',
    'code',
    'blockquote',
    'strike'
  ]
};

export class TwitchChat {
  public tmi: Client;
  private clientUsername: string = config.twitchBotUsername;
  private socket!: SocketIOClient.Socket;
  private activeStream: IStream | undefined;
  private lastAVCommandTime = new Date();
  private avCommandThrottle = +config.avCommandThrottleInSeconds;
  private announcedTeamMembers: string[] = [];

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
    this.tmi.on('resub', this.onResub);
    this.tmi.on('subgift', this.onGiftSub);
    this.tmi.on('subscription', this.onSub);

    this.socket.on(SocketIOEvents.StreamStarted, (currentStream: IStreamEventArg) => {
      this.activeStream = currentStream.stream;
    });

    this.socket.on(SocketIOEvents.StreamUpdated, (currentStream: IStreamEventArg) => {
      this.activeStream = currentStream.stream;
    });

    this.socket.on(
      SocketIOEvents.CandleWinner,
      (candleWinner: ICandleWinnerEventArg) => {
        setTimeout(() => {
          this.sendChatMessage(
            `The vote is over and today's Candle to Code By is ${
              candleWinner.candle.label
            }.  You can try it yourself at ${candleWinner.candle.url}`
          );
        }, 12500);
      }
    );

    this.socket.on(SocketIOEvents.StreamEnded, () => {
      this.activeStream = undefined;
    });
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
  public sendChatMessage = (message: string): void => {
    // Default to first channel in connected channels
    this.tmi.say(config.twitchClientUsername, message);
  };

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
  private onUserJoined = async (
    channel: string,
    username: string,
    self: boolean
  ) => {
    // Identify user and add to user state if needed
    await this.updateAndGetUser(username);

    log('info', `${username} has JOINED the channel`);
    const userJoinedEventArg: IUserJoinedEventArg = {
      username
    };

    this.emitMessage(SocketIOEvents.OnUserJoined, userJoinedEventArg);

    if (self) {
      log('info', 'This client joined the channel...');
      // Assume first channel in channels array is 'self' - owner monitoring their own channel
      setTimeout(this.pingTtv, 30000);
    }
  };

  /**
   * When a user leaves the channel
   */
  private onUserLeft = async (channel: string, username: string) => {
    const userLeftEventArg: IUserLeftEventArg = {
      username
    };

    this.emitMessage(SocketIOEvents.OnUserLeft, userLeftEventArg);

    log('info', `${username} has LEFT the channel`);
  };

  /**
   * When a user raids the channel
   */
  private onRaid = async (
    channel: string,
    username: string,
    viewers: number
  ) => {
    if (this.activeStream) {
      // Identify user and add to user state if needed
      const userInfo: IUserInfo = await this.getUser(username);

      const userDisplayName: string = userInfo.display_name || userInfo.login;

      const raider: IRaider = {
        user: userInfo,
        viewers
      };

      this.sendChatMessage(
        `WARNING!!! ${userDisplayName} is raiding us with ${viewers} accomplices!  DEFEND!!`
      );

      const newRaidEventArg: INewRaidEventArg = {
        raider,
        streamId: this.activeStream.id
      };

      this.emitMessage(SocketIOEvents.NewRaid, newRaidEventArg);

      log('info', `${username} has RAIDED the channel with ${viewers} viewers`);
    }
  };

  /**
   * When a user cheers
   */
  private onCheer = async (
    channel: string,
    user: Userstate,
    message: string
  ) => {
    if (this.activeStream) {
      const username: string = user.username ? user.username : '';
      const bits = user.bits || 0;

      // Identify user and add to user state if needed
      const userInfo: IUserInfo = await this.getUser(username);

      const cheerer: ICheer = {
        bits,
        user: userInfo
      };

      const cheerEventArg: INewCheerEventArg = {
        cheerer,
        streamId: this.activeStream.id
      };

      this.emitMessage(SocketIOEvents.NewCheer, cheerEventArg);
      log('info', `${user.username} cheered ${bits} bits`);
    }
  };

  private onGiftSub = async (
    channel: string,
    username: string,
    streakMonths: number,
    recipient: string,
    methods: any,
    user: SubGiftUserstate
  ) => {
    log('info', JSON.stringify(user));

    const recipientName = user['msg-param-recipient-user-name'] || '';

    if (recipientName) {
      // Identify user and add to user state if needed
      const userInfo: IUserInfo = await this.getUser(recipientName);

      await this.onAnySub(userInfo, true, '', 1);
    }
  };

  private onResub = async (
    channel: string,
    username: string,
    streakMonths: number,
    message: string,
    user: SubUserstate,
    methods: any
  ) => {
    log('info', JSON.stringify(user));

    const subscriberName = user.login || '';

    if (subscriberName) {
      // Identify user and add to user state if needed
      const userInfo: IUserInfo = await this.getUser(subscriberName);
      let cumulativeMonths: number = 1;
      if (user['msg-param-cumulative-months']) {
        cumulativeMonths = !isNaN(
          parseInt(user['msg-param-cumulative-months'].toString(), 10)
        )
          ? parseInt(user['msg-param-cumulative-months'].toString(), 10)
          : 0;
      }

      await this.onAnySub(userInfo, true, '', cumulativeMonths);
    }
  };

  private onSub = async (
    channel: string,
    username: string,
    methods: any,
    message: string,
    user: SubUserstate
  ) => {
    log('info', JSON.stringify(user));

    const subscriberName = user.login || '';

    if (subscriberName) {
      // Identify user and add to user state if needed
      const userInfo: IUserInfo = await this.getUser(subscriberName);

      await this.onAnySub(userInfo, true, message, 1);
    }
  };

  private onAnySub = async (
    userInfo: IUserInfo,
    wasGift: boolean,
    message: string,
    cumulativeMonths: number
  ) => {
    if (this.activeStream) {
      const subscriber: ISubscriber = {
        cumulativeMonths,
        user: userInfo,
        wasGift
      };
      const newSubscriberArg: INewSubscriptionEventArg = {
        streamId: this.activeStream.id,
        subscriber
      };

      this.emitMessage(SocketIOEvents.NewSubscriber, newSubscriberArg);

      log('info', `${userInfo.login} subscribed`);
    }
  };

  /**
   * When a user sends a message in chat
   */
  private onChatMessage = async (
    channel: string,
    user: ChatUserstate,
    message: string
  ): Promise<any> => {
    const originalMessage = message;

    // Parse chat for any commands & update
    // message for display in overlays
    message = this.processChatMessage(message, user);

    const username: string = user.username || '';

    // Identify user and pass along to hub
    const userInfo: IUserInfo = await this.getUser(username);

    const chatMessageArg: IChatMessageEventArg = {
      message,
      user,
      userInfo
    };

    if (this.activeStream && user.mod) {
      const userEvent: IUserEventArg = {
        streamId: this.activeStream.id,
        user: userInfo
      };
      this.emitMessage(SocketIOEvents.OnModeratorJoined, userEvent);
    }

    let handledByCommand: boolean = false;

    //Process user commands first before emitting message to hub
    //so if the user updates, the update is handled before notification
    for (const userCommand of Object.values(UserCommands)) {
      let updatedUser: IUserInfo | boolean = await userCommand(
        originalMessage,
        user,
        this.sendChatMessage
      );
      if (updatedUser) {
        handledByCommand = true;

        if (typeof updatedUser !== "boolean") {
          chatMessageArg.userInfo = updatedUser;
        }

        break;
      }
    }

    //Go ahead and emit message to hub before processing the rest of the commands
    this.emitMessage(SocketIOEvents.OnChatMessage, chatMessageArg);
    
    if (!handledByCommand) {
      for (const basicCommand of Object.values(BasicCommands)) {
        handledByCommand = await basicCommand(
          originalMessage,
          user,
          this.sendChatMessage
        );
        if (handledByCommand) {
          break;
        }
      }
    }

    if (!handledByCommand &&
      !this.isCommandThrottled( this.lastAVCommandTime, this.avCommandThrottle, user)) {
      for (const avCommand of Object.values(AVCommands)) {
        handledByCommand = avCommand(
          originalMessage,
          user,
          userInfo,
          this.activeStream,
          this.sendChatMessage,
          this.emitMessage
        );
        if (handledByCommand) {
          this.lastAVCommandTime = new Date();
          break;
        }
      }
    }

    if (!handledByCommand) {
      for (const streamCommand of Object.values(StreamCommands)) {
        handledByCommand = streamCommand(
          originalMessage,
          user,
          userInfo,
          this.activeStream,
          this.sendChatMessage,
          this.emitMessage
        );
        if (handledByCommand) {
          break;
        }
      }
    }

    if (!handledByCommand) {
      for (const noteCommand of Object.values(NoteCommands)) {
        handledByCommand = await noteCommand(
          originalMessage,
          user,
          userInfo,
          this.activeStream,
          this.getUser,
          this.sendChatMessage,
          this.emitMessage
        );
        if (handledByCommand) {
          break;
        }
      }
    }

    if (!handledByCommand) {
      for (const candleCommand of Object.values(CandleCommands)) {
        handledByCommand = await candleCommand(
          originalMessage,
          user,
          userInfo,
          this.activeStream,
          this.sendChatMessage,
          this.emitMessage
        );
        if (handledByCommand) {
          break;
        }
      }
    }

    if (userInfo.liveCodersTeamMember && this.announcedTeamMembers.find(login => login !== userInfo.login)) {
      if (BasicCommands.shoutoutCommand(`!so ${user.username}`, undefined, this.sendChatMessage)) {
        this.announcedTeamMembers.push(userInfo.login);
      }
    }
  };

  /**
   * This weeds through the trolls and deciphers if the message is something that we want to do
   * something about
   *
   * @param message the message sent by a user
   * @param user the user who sent the message
   */
  private processChatMessage = (
    message: string,
    user: ChatUserstate
  ): string => {
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
        const emoteArg: IEmoteEventArg = {
          emoteUrl: emote.emoteUrl
        };

        this.emitMessage(SocketIOEvents.EmoteSent, emoteArg);

        let emoteMessage = tempMessage.slice(0, emote.start);
        emoteMessage += emote.emoteImageTag;
        emoteMessage += tempMessage.slice(emote.end + 1, tempMessage.length);
        tempMessage = emoteMessage;
      });
    }

    return tempMessage;
  };

  private getUser = async (username: string): Promise<IUserInfo> => {
    const url = `http://user/users/${username}`;

    return await get(url).then((user: any) => {
      return user;
    });
  };

  private updateAndGetUser = async (username: string): Promise<IUserInfo> => {
    const url = `http://user/update/${username}/false`;

    return await get(url).then((user: any) => {
      return user;
    });
  };

  private emitMessage = (event: string, payload: IBaseEventArg) => {
    if (!this.socket.disconnected) {
      this.socket.emit(event, payload);
    }
  };

  private isCommandThrottled = (lastAVCommandTime: Date, commandThrottleInSeconds: number, user: any): boolean => {
    const timeDifference = new Date().getTime() - lastAVCommandTime.getTime();
    if (timeDifference >= (commandThrottleInSeconds * 1000) || this.shouldOverrideThrottle(user)) {
      return false;
    }
    return true;
  };

  private shouldOverrideThrottle = (user: any): boolean => {
    if (isMod(user) || isBroadcaster(user))
    {
      return true;
    }
    return false;
  }
}
