import moment from 'moment';

import { IStream } from "./models/index";

export class Markdowner {

  private activeStream: IStream | undefined;

  constructor(stream: IStream | undefined) {
    this.activeStream = stream;
  }

  public async generateMarkdown() : Promise<string> {
    if (this.activeStream) {

      return this.addMeta()
              .then(this.addImage)
              .then(this.addYouTube)
              .then(this.addFold)
              .then(this.addSegments) // TODO
              .then(this.addLine)
              .then(this.addCandle)
              .then(this.addLine)
              .then(this.addGoals) // TODO
              .then(this.addThingsLearned) // TODO
              .then(this.addLine)
              .then(this.addSponsors)
              .then(this.addSubscriptions)
              .then(this.addCheers)
              .then(this.addRaiders)
              .then(this.addFollowers);

    }
    else {
      return '';
    }
  }

  private addFollowers = async (existingContent: string) : Promise<string> => {
    this.activeStream = this.activeStream as IStream;

    if (this.activeStream.followers) {
      let response: string = `### Followers\n\n`;

      for (const follower of this.activeStream.followers) {
        const displayName: string = follower.display_name || follower.login;
        response = response +  `- ${this.addLink(displayName, 'https://twitch.tv/' + follower.login)}\n`;
      }
      return existingContent + response + `\n`;
    }

    return existingContent;
  }

  private  addRaiders = async (existingContent: string) : Promise<string> => {
    this.activeStream = this.activeStream as IStream;

    if (this.activeStream.raiders) {
      let response: string = `### Raids\n\n
| Marauder            | Accomplices |
| ---                 | ---         |\n`;

      for (const raider of this.activeStream.raiders) {
        const displayName: string = raider.user.display_name || raider.user.login;
        response = response + `| ${this.addLink(displayName, 'https://twitch.tv/' + raider.user.login)} | ${raider.viewers} |\n`;
      }
      return existingContent + response + `\n`;
    }

    return existingContent;
  }

  private  addCheers = async (existingContent: string) : Promise<string> => {
    this.activeStream = this.activeStream as IStream;

    if (this.activeStream.cheers) {
      let response: string = `### Cheers\n\n
| Compadre            | Bits        |
| ---                 | ---         |\n`;

      for (const cheerer of this.activeStream.cheers) {
          const displayName: string = cheerer.user.display_name || cheerer.user.login;
          response = response + `| ${this.addLink(displayName, 'https://twitch.tv/' + cheerer.user.login)} | ${cheerer.bits} |\n`;
      }
      return existingContent + response + `\n`;
    }

    return existingContent;
  }

  private  addSubscriptions =  async (existingContent: string) : Promise<string> => {
    this.activeStream = this.activeStream as IStream;

    if (this.activeStream.subscribers) {
      let response: string = `### Subscribers\n\n`;

      for (const sub of this.activeStream.subscribers) {
        const displayName: string = sub.user.display_name || sub.user.login;
        let subLine: string = `- ${this.addLink(displayName, 'https://twitch.tv/' + sub.user.login)}`;
        if (sub.cumulativeMonths > 1) {
          subLine = subLine + ` (${sub.cumulativeMonths} mo)`;
        }
        if (sub.wasGift) {
          subLine = subLine + ' `Gifted`';
        }
        response = response + `${subLine}\n`;
      }
      return existingContent + response + `\n`;
    }

    return existingContent;
  }

  private  addCandle = async (existingContent: string) : Promise<string> => {
    this.activeStream = this.activeStream as IStream;

    if (this.activeStream.candle) {
      return existingContent + `### Today's Candle To Code By\n
${this.addLink(this.activeStream.candle.label, this.activeStream.candle.url)}\n\n`;
    }

    return existingContent;
  }

  private addThingsLearned = async (existingContent: string) : Promise<string> => {
    return existingContent + `## Things we learned\n
- \n\n`;
  }

  private addImage = async (existingContent: string) : Promise<string> => {
    return existingContent + '<img src="{{page.image}}"/>\n\n';
  }

  private addYouTube = async (existingContent: string) : Promise<string> => {
    return existingContent + `## Stream Replay Link\n
{YOUTUBE LINK GOES HERE}\n\n`;
  }

  private addFold = async (existingContent: string) : Promise<string> => {
    return existingContent + `<!--more-->\n\n`;
  }

  private addSegments = async (existingContent: string) : Promise<string> => {
    return existingContent + `### Segments\n
| Timestamp | Topic
| ---       | ---\n\n`;
  }

  private addLine = async (existingContent: string) : Promise<string> => {
    return existingContent + `---\n\n`;
  }

  private addGoals = async (existingContent: string) : Promise<string> => {
    return existingContent + `## Goals\n
- [ ]\n\n`;
  }

  private addSponsors = async (existingContent: string) : Promise<string> => {
    return existingContent + `## Today's stream brought to you by\n\n`;
  }

  private addLink = (label: string, url: string) : string => {
    return `[${label}](${url})`;
  }

  private addMeta = async () : Promise<string> => {
    this.activeStream = this.activeStream as IStream;

    return `---
layout: post
date: ${moment(this.activeStream.started_at).format('YYYY-MM-DD HH:MM')}
title: "${this.activeStream.title.split('- ')[1]}"
image:
description: ""
comments: true
tags: [twitch, stream]
---\n\n`;
  }

}
