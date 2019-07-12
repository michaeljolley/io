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
              .then(this.addSegments)
              .then(this.addLine)
              .then(this.addCandle)
              .then(this.addLine)
              .then(this.addGoals)
              .then(this.addThingsLearned)
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
    return existingContent + '';
  }

  private  addRaiders = async (existingContent: string) : Promise<string> => {
    return existingContent + '';
  }

  private  addCheers = async (existingContent: string) : Promise<string> => {
    return existingContent + '';
  }

  private  addSubscriptions =  async (existingContent: string) : Promise<string> => {
    return existingContent + '';
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
    return existingContent + '';
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
| Timestamp | Topic |
| -- | -- |\n\n`;
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
title: "${this.activeStream.title.split('-')[1]}"
image:
description: ""
comments: true
tags: [twitch, stream]
---`;
  }

}
