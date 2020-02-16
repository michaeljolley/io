import * as fs from 'fs';
import * as path from 'path';
import { Userstate } from 'tmi.js';

import { SocketIOEvents } from '@shared/events';
import { log, isMod, isBroadcaster } from '@shared/common';
import {
  IMediaEventArg,
  IThemerEventArg,
  IBaseEventArg
} from '@shared/event_args';
import { IUserInfo, IStream } from '@shared/models/index';

const assetsDir: string = path.join(__dirname, '..', 'assets');
const soundClipsDir: string = path.join(assetsDir, 'audio', 'clips');
const soundBytes: string[] = [];
const hiddenSoundBytes: string[] = ['shame', 'sweethome', 'hailed'];
const modOnlySoundBytes: string[] = [];
const broadcasterOnlySoundBytes: string[] = ['fullstack', 'sub'];

export const soundByteCommand = (
  message: string,
  user: Userstate,
  userInfo: IUserInfo,
  activeStream: IStream | undefined,
  twitchChatFunc: (message: string) => void,
  emitMessageFunc: (event: string, payload: IBaseEventArg) => void
): boolean => {
  if (activeStream) {
    // On first execution load the audio files
    if (soundBytes.length === 0) {
      const files = fs.readdirSync(soundClipsDir);
      files.forEach(file => {
        soundBytes.push(file.toLocaleLowerCase().replace('.mp3', ''));
      });
    }

    if (message === undefined || message.length === 0) {
      return false;
    }

    const availableEffects = soundBytes.filter(
      f =>
        hiddenSoundBytes.indexOf(f) === -1 &&
        (isBroadcaster(user) ||
          (isMod(user) && broadcasterOnlySoundBytes.indexOf(f) === -1) ||
          (modOnlySoundBytes.indexOf(f) === -1 &&
            broadcasterOnlySoundBytes.indexOf(f) === -1))
    );

    const lowerMessage = message.toLocaleLowerCase().trim();
    const firstWord = lowerMessage
      .split(' ')[0]
      .replace('!', '')
      .toLocaleLowerCase();

    if (availableEffects.indexOf(firstWord) !== -1 && emitMessageFunc) {
      // Send the hub command to play audio
      const avEventArg: IMediaEventArg = {
        clipName: firstWord,
        streamDate: activeStream.streamDate,
        user: userInfo
      };
      emitMessageFunc(SocketIOEvents.PlayAudio, avEventArg);

      log('info', `AV-Command: Play - ${firstWord}.mp3`);

      return true;
    }
  }

  return false;
};

export const attentionCommand = (
  message: string,
  user: Userstate,
  userInfo: IUserInfo,
  activeStream: IStream | undefined,
  twitchChatFunc: (message: string) => void,
  emitMessageFunc: (event: string, payload: IBaseEventArg) => void
): boolean => {
  if (activeStream) {
    if (message === undefined || message.length === 0) {
      return false;
    }

    const lowerMessage = message.toLocaleLowerCase().trim();
    const firstWord = lowerMessage.split(' ')[0];

    if (firstWord !== '!attention') {
      return false;
    }

    if (twitchChatFunc && emitMessageFunc) {
      // Send the hub command to play audio
      const avEventArg: IMediaEventArg = {
        clipName: 'hailed',
        streamDate: activeStream.streamDate,
        user: userInfo
      };
      emitMessageFunc(SocketIOEvents.PlayAudio, avEventArg);

      const displayName = userInfo.display_name || userInfo.login;

      twitchChatFunc(
        `@theMichaelJolley, ${displayName} is trying to get your attention.`
      );

      log('info', `AV-Command: Attention`);

      return true;
    }
  }

  return false;
};

export const soundFXCommand = (
  message: string,
  user: Userstate,
  userInfo: IUserInfo,
  activeStream: IStream | undefined,
  twitchChatFunc: (message: string) => void,
  emitMessageFunc: (event: string, payload: IBaseEventArg) => void
): boolean => {
  if (message === undefined || message.length === 0) {
    return false;
  }

  if (activeStream) {
    const lowerMessage = message.toLocaleLowerCase().trim();
    const firstWord = lowerMessage.split(' ')[0];

    if (firstWord !== '!sfx') {
      return false;
    }

    // On first execution load the audio files
    if (soundBytes.length === 0) {
      const files = fs.readdirSync(soundClipsDir);
      files.forEach(file => {
        soundBytes.push(file.toLocaleLowerCase().replace('.mp3', ''));
      });
    }

    const availableEffects = soundBytes.filter(
      f =>
        hiddenSoundBytes.indexOf(f) === -1 &&
        broadcasterOnlySoundBytes.indexOf(f) === -1 &&
        modOnlySoundBytes.indexOf(f) === -1
    );

    const audioCommands = availableEffects.map(m => `!${m}`).join(', ');

    twitchChatFunc(
      `The following commands are available as sound effects: ${audioCommands}`
    );

    log('info', `AV-Command: sfx`);
    return true;
  }

  return false;
};

export const stopAudioCommand = (
  message: string,
  user: Userstate,
  userInfo: IUserInfo,
  activeStream: IStream | undefined,
  twitchChatFunc: (message: string) => void,
  emitMessageFunc: (event: string, payload: any) => void
): boolean => {
  if (activeStream) {
    if (message === undefined || message.length === 0) {
      return false;
    }

    const lowerMessage = message.toLocaleLowerCase().trim();
    const firstWord = lowerMessage.split(' ')[0];

    if (firstWord !== '!stop') {
      return false;
    }

    if (twitchChatFunc) {
      emitMessageFunc(SocketIOEvents.StopAudio, undefined);
      return true;
    }
  }

  return false;
};

export const themeShameCommand = (
  message: string,
  user: Userstate,
  userInfo: IUserInfo,
  activeStream: IStream | undefined,
  twitchChatFunc: (message: string) => void,
  emitMessageFunc: (event: string, payload: IBaseEventArg) => void
): boolean => {
  if (activeStream) {
    if (message === undefined || message.length === 0) {
      return false;
    }

    const lowerMessage = message.toLocaleLowerCase().trim();
    const words = lowerMessage.split(' ');
    const shamedThemes: string[] = [
      'hotdogstand',
      'lasers',
      'bbbdark',
      'bbblight',
      'bbbgarish',
      'powershell'
    ];

    if (words.length > 1) {
      if (words[0] === '!theme' && shamedThemes.indexOf(words[1]) !== -1) {
        if (emitMessageFunc && twitchChatFunc) {
          const username = user['display-name']
            ? user['display-name']
            : user.username;

          if (words[1] == 'lasers' && user.username == 'dot_commie') {
            return false;
          }

          // Send shame command to chat
          switch (words[1]) {
            case 'hotdogstand':
              twitchChatFunc(`HotDog Stand!?! Shame on you @${username}`);
              break;
            case 'lasers':
              twitchChatFunc(`Lasers!?! Shame on you @${username}`);
              break;
          }

          // Send the hub command to play shame audio
          const avEventArg: IMediaEventArg = {
            clipName: 'shame',
            streamDate: activeStream.streamDate,
            user: userInfo
          };
          emitMessageFunc(SocketIOEvents.PlayAudio, avEventArg);

          log('info', `themeShameCommand: Play - shame.mp3`);
          return true;
        }
      }
    }
  }
  return false;
};

export const twitchThemerCommand = (
  message: string,
  user: Userstate,
  userInfo: IUserInfo,
  activeStream: IStream | undefined,
  twitchChatFunc: (message: string) => void,
  emitMessageFunc: (event: string, payload: IBaseEventArg) => void
): boolean => {
  if (activeStream) {
    if (message === undefined || message.length === 0) {
      return false;
    }

    const lowerMessage = message.toLocaleLowerCase().trim();
    const words = lowerMessage.split(' ');

    if (words[0] === '!theme') {
      if (emitMessageFunc) {
        // Send the hub command to record contributor
        const themerEventArg: IThemerEventArg = {
          streamDate: activeStream.streamDate,
          user: userInfo
        };
        emitMessageFunc(SocketIOEvents.TwitchThemer, themerEventArg);

        log('info', `onTwitchThemer: ${userInfo.login}`);
        return true;
      }
    }
  }
  return false;
};
