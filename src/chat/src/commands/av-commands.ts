import * as fs from 'fs';
import * as path from 'path';

import { log } from '../common';

const assetsDir: string = path.join(__dirname, '..', 'assets');
const soundClipsDir: string = path.join(assetsDir, 'audio', 'clips');
const soundBytes: string[] = [];
// const modOnlySoundBytes: string[] = [];
// const broadcasterOnlySoundBytes: string[] = ['fullstack', 'sub'];

export const soundByteCommand = (message: string, twitchChatFunc: Function, emitMessageFunc: Function) : boolean => {

  // On first execution load the audio files
  if (soundBytes.length === 0) {
    const files = fs.readdirSync(soundClipsDir);
    files.forEach(file => {
      soundBytes.push(file.toLocaleLowerCase().replace('.mp3',''));
    });
  }

  if (message === undefined || message.length === 0) {
    return false;
  }

  const lowerMessage = message.toLocaleLowerCase().trim();
  const firstWord = lowerMessage.split(' ')[0].replace('!', '').toLocaleLowerCase();

  if (soundBytes.indexOf(firstWord) !== -1) {
    // Send the hub command to play audio
    emitMessageFunc('playAudio', firstWord);

    log('info', `AV-Command: Play - ${firstWord}.mp3`);

    return true;
  }

  return false;
};
