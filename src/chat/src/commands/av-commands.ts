import * as fs from 'fs';
import * as path from 'path';
import { Userstate } from 'tmi.js';

import { log, isMod, isBroadcaster } from '../common';
import { IMediaEventArg, IThemerEventArg } from '../event_args';
import { IUserInfo, IStream } from '../models/index';

const assetsDir: string = path.join(__dirname, '..', 'assets');
const soundClipsDir: string = path.join(assetsDir, 'audio', 'clips');
const soundBytes: string[] = [];
const hiddenSoundBytes: string[] = ['shame', 'sweethome'];
const modOnlySoundBytes: string[] = [];
const broadcasterOnlySoundBytes: string[] = ['fullstack', 'sub'];

export const soundByteCommand = (
  message: string,
  user: Userstate,
  userInfo: IUserInfo,
  activeStream: IStream | undefined,
  twitchChatFunc: Function,
  emitMessageFunc: Function
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

    const availableEffects = soundBytes.filter(f =>
      hiddenSoundBytes.indexOf(f) === -1 &&
      (isBroadcaster(user) ||
      (isMod(user) && broadcasterOnlySoundBytes.indexOf(f) === -1) ||
      (modOnlySoundBytes.indexOf(f) === -1 && broadcasterOnlySoundBytes.indexOf(f) === -1))
    );

    const lowerMessage = message.toLocaleLowerCase().trim();
    const firstWord = lowerMessage
      .split(' ')[0]
      .replace('!', '')
      .toLocaleLowerCase();

    if (
      availableEffects.indexOf(firstWord) !== -1 &&
      emitMessageFunc
    ) {
      // Send the hub command to play audio
      const avEventArg: IMediaEventArg = {
        clipName: firstWord,
        streamId: activeStream.id,
        user: userInfo
      };
      emitMessageFunc('playAudio', avEventArg);

      log('info', `AV-Command: Play - ${firstWord}.mp3`);

      return true;
    }
  }

  return false;
};

export const stopAudioCommand = (
  message: string,
  user: Userstate,
  userInfo: IUserInfo,
  activeStream: IStream | undefined,
  twitchChatFunc: Function,
  emitMessageFunc: Function
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
      emitMessageFunc('stopAudio');
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
  twitchChatFunc: Function,
  emitMessageFunc: Function
): boolean => {

  if (activeStream) {
    if (message === undefined || message.length === 0) {
      return false;
    }

    const lowerMessage = message.toLocaleLowerCase().trim();
    const words = lowerMessage.split(' ');
    const shamedThemes: string[] = ['hotdogstand', 'lasers'];

    if (words.length > 1) {
      if (words[0] === '!theme' && shamedThemes.indexOf(words[1]) !== -1) {
        if (emitMessageFunc && twitchChatFunc) {

          const username = user["display-name"] ? user["display-name"] : user.username;

          // Send the hub command to play shame audio
          const avEventArg: IMediaEventArg = {
            clipName: 'shame',
            streamId: activeStream.id,
            user: userInfo
          };
          emitMessageFunc('playAudio', avEventArg);

          // Send shame command to chat
          switch (words[1]) {
            case 'hotdogstand':
              twitchChatFunc(`HotDog Stand!?! Shame on you @${username}`);
              break;
            case 'lasers':
              twitchChatFunc(`Lasers!?! Shame on you @${username}`);
              break;
          }

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
  twitchChatFunc: Function,
  emitMessageFunc: Function
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
          streamId: activeStream.id,
          user: userInfo
        };
        emitMessageFunc('onTwitchThemer', themerEventArg);

        log('info', `onTwitchThemer: ${userInfo.login}`);
        return true;
      }
    }
  }
  return false;
};
