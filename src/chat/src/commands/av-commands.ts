import * as fs from 'fs';
import * as path from 'path';
import { Userstate } from 'tmi.js';

import { log, isMod, isBroadcaster } from '../common';

const assetsDir: string = path.join(__dirname, '..', 'assets');
const soundClipsDir: string = path.join(assetsDir, 'audio', 'clips');
const soundBytes: string[] = [];
const hiddenSoundBytes: string[] = ['shame', 'sweethome'];
const modOnlySoundBytes: string[] = [];
const broadcasterOnlySoundBytes: string[] = ['fullstack', 'sub'];

export const soundByteCommand = (
  message: string,
  user: Userstate,
  twitchChatFunc: Function,
  emitMessageFunc: Function
): boolean => {
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
    emitMessageFunc('playAudio', firstWord);

    log('info', `AV-Command: Play - ${firstWord}.mp3`);

    return true;
  }

  return false;
};

export const stopAudioCommand = (
  message: string,
  user: Userstate,
  twitchChatFunc: Function,
  emitMessageFunc: Function
): boolean => {

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

  return false;
};

export const themeShameCommand = (
  message: string,
  user: Userstate,
  twitchChatFunc: Function,
  emitMessageFunc: Function
): boolean => {

  if (message === undefined || message.length === 0) {
    return false;
  }

  const lowerMessage = message.toLocaleLowerCase().trim();
  const words = lowerMessage.split(' ');
  const shamedThemes: string[] = ['hotdogstand'];

  if (words.length > 1) {
    if (words[0] === '!theme' && shamedThemes.indexOf(words[1]) !== -1) {
      if (emitMessageFunc && twitchChatFunc) {

        const username = user["display-name"] ? user["display-name"] : user.username;

        // Send the hub command to play shame audio
        emitMessageFunc('playAudio', 'shame');

        // Send shame command to chat
        twitchChatFunc(`HotDog Stand!?! Shame on you @${username}`);

        log('info', `themeShameCommand: Play - shame.mp3`);
        return true;
      }
    }
  }

  return false;
};
