import moment from 'moment';

import { ICandleVote, IStream, IStreamNote, IStreamSegment, IUserInfo, IChatMessage } from '@shared/models';
import { config } from '@shared/common';

export class Markdowner {
  private activeStream: IStream | undefined;

  constructor(stream: IStream | undefined) {
    this.activeStream = stream;
  }

  public async generateMarkdown(): Promise<string> {
    if (this.activeStream) {
      return this.addMeta()
        .then(this.addYouTube)
        .then(this.addFold)
        .then(this.addSegments)
        .then(this.addCandle)
        .then(this.addGoals)
        .then(this.addGitHubRepos)
        .then(this.addThingsLearned)
        .then(this.addSponsors)
        .then(this.addSubscriptions)
        .then(this.addCheers)
        .then(this.addRaiders)
        .then(this.addModerators)
        .then(this.addContributors)
        .then(this.addFollowers);
    } else {
      return '';
    }
  }

  private addFollowers = async (existingContent: string): Promise<string> => {
    this.activeStream = this.activeStream as IStream;

    if (this.activeStream.followers &&
        this.activeStream.followers.length > 0) {
      let response: string = `### Followers\n\n`;

      response = response + this.generateUserTable(this.activeStream.followers);

      return existingContent + response + `\n`;
    }

    return existingContent;
  };

  private addRaiders = async (existingContent: string): Promise<string> => {
    this.activeStream = this.activeStream as IStream | undefined;

    if (this.activeStream &&
        this.activeStream.raiders &&
        this.activeStream.raiders.length > 0) {

      let response: string = `### Raids\n\n`;

      response = response + this.generateUserTable(this.activeStream.raiders.map(m => m.user));

      return existingContent + response + `\n`;
    }

    return existingContent;
  };

  private addCheers = async (existingContent: string): Promise<string> => {
    this.activeStream = this.activeStream as IStream;

    if (this.activeStream.cheers &&
        this.activeStream.cheers.length > 0) {
      let response: string = `### Cheers\n\n`;

      response = response + this.generateUserTable(this.activeStream.cheers.map(m => m.user));

      return existingContent + response + `\n`;
    }

    return existingContent;
  };

  private addSubscriptions = async (
    existingContent: string
  ): Promise<string> => {
    this.activeStream = this.activeStream as IStream;

    if (this.activeStream.subscribers &&
        this.activeStream.subscribers.length > 0) {
      let response: string = `### Subscribers\n\n`;

      response = response + this.generateUserTable(this.activeStream.subscribers.map(m => m.user));

      return existingContent + response + `\n`;
    }

    return existingContent;
  };

  private addModerators = async (existingContent: string): Promise<string> => {
    this.activeStream = this.activeStream as IStream;

    if (this.activeStream.moderators &&
        this.activeStream.moderators.length > 0) {
      let response: string = `### Moderators\n\n`;

      const mods = this.activeStream.moderators.filter(f => f.login != config.twitchClientUsername &&
                                                            f.login != config.twitchBotUsername);

      response = response + this.generateUserTable(mods);

      return existingContent + response + `\n`;
    }

    return existingContent;
  };

  private addContributors = async (
    existingContent: string
  ): Promise<string> => {

    if (this.activeStream) {
      this.activeStream = this.activeStream as IStream;

      let contributors: IUserInfo[] = [];

      if (this.activeStream.contributors) {
        contributors.push(...this.activeStream.contributors);
      }

      if (this.activeStream.candleVotes) {
        contributors.push(...this.activeStream.candleVotes.map((m: ICandleVote) => m.user));
      }

      if (this.activeStream.segments) {
        contributors.push(...this.activeStream.segments.map((m: IStreamSegment) => m.user));
      }

      if (this.activeStream.notes) {
        contributors.push(...this.activeStream.notes.map((m: IStreamNote) => m.user));
      }

      if (this.activeStream.chatMessages) {
        contributors.push(...this.activeStream.chatMessages.map((m: IChatMessage) => m.user));
      }

      const tempContributors: any[] = [];
      contributors = contributors.filter((n: any) => {
                      return tempContributors.indexOf(n.id) === -1 &&
                              n.login !== config.twitchClientUsername &&
                              n.login !== config.twitchBotUsername &&
                              tempContributors.push(n.id);
                    });

      if (contributors.length > 0) {
        let response: string = `### Contributors\n\n`;

        response = response + this.generateUserTable(contributors);

        return existingContent + response + `\n`;
      }
    }
    return existingContent;
  };

  private addCandle = async (existingContent: string): Promise<string> => {
    this.activeStream = this.activeStream as IStream;

    if (this.activeStream.candle) {
      return (
        existingContent +
        `### Today's Candle To Code By\n
${this.addLink(
  this.activeStream.candle.label,
  this.activeStream.candle.url
)}\n\n`
      );
    }

    return existingContent;
  };

  private addThingsLearned = async (
    existingContent: string
  ): Promise<string> => {
    this.activeStream = this.activeStream as IStream;

    let response: string = '';

    if (this.activeStream.notes &&
        this.activeStream.notes.length > 0) {
      response = `### Things We Learned\n\n`;
      for (const note of this.activeStream.notes) {
        if (note.user) {
          const displayName = note.user.display_name || note.user.login;
          response = response + `- ${this.addLink(
            displayName,
            'https://twitch.tv/' + note.user.login
          )}: ${note.name} \n`;
        }
      }
      return existingContent + response + `\n`;
    }

    return existingContent + response;
  };

  private addYouTube = async (existingContent: string): Promise<string> => {
    return (
      existingContent +
      `### Stream Replay Link\n
[{{page.replay}}]({{page.replay}})\n\n`
    );
  };

  private addFold = async (existingContent: string): Promise<string> => {
    return existingContent + `<!--more-->\n\n`;
  };

  private addSegments = async (existingContent: string): Promise<string> => {
    this.activeStream = this.activeStream as IStream;

    let response: string = `### Segments\n
| Timestamp | Topic
| ---       | ---\n`;

    if (this.activeStream.segments) {
      const startedAt: moment.Moment = moment(this.activeStream.started_at);

      for (const segment of this.activeStream.segments) {
        const segmentTime: moment.Moment = moment(segment.timestamp);
        const timestamp: moment.Duration = moment.duration(segmentTime.diff(startedAt));
        const hours: string = timestamp.get('hours') > 9 ? `${timestamp.get('hours')}` : `0${timestamp.get('hours')}`;
        const minutes: string = timestamp.get('minutes') > 9 ? `${timestamp.get('minutes')}` : `0${timestamp.get('minutes')}`;
        response = response + `| [${hours}:${minutes}]({{page.replay}}?t=${timestamp.asSeconds()}) | ${segment.topic} |\n`;
      }
    }

    return existingContent + response + `\n`;
  };

  private generateUserTable = (users: IUserInfo[]) : string => {
    let table: string = `<div class="users">\n`;

    for (const user of users) {

      table += `  <div class="user">\n`;
      table += `    <img class="profile" src="${user.profile_image_url}"/>\n`;
      table += `    <span>${user.display_name || user.login}<br/>\n`;
      table += `      <a href="https://twitch.tv/${user.login}" target="_blank"><i class="fab fa-twitch" aria-hidden="true"></i></a>`;
      if (user.twitterHandle) {
        table += `<a href="https://twitter.com/${user.twitterHandle}" target="_blank"><i class="fab fa-twitter" aria-hidden="true"></i></a>`;
      }
      if (user.githubHandle) {
        table += `<a href="https://github.com/${user.githubHandle}" target="_blank"><i class="fab fa-github" aria-hidden="true"></i></a>`;
      }
      table += "</span>\n  </div>\n";
    }

    table += "</div>\n";

    return table;
  }

  private addGoals = async (existingContent: string): Promise<string> => {
    this.activeStream = this.activeStream as IStream;

    let response: string = `### Goals\n\n`;

    if (this.activeStream.goals) {

      for (const goal of this.activeStream.goals) {
        response = response + `- [${(goal.accomplished ? 'x' : ' ')}] ${goal.name}\n`;
      }
    }

    return existingContent + response + `\n`;
  };

  private addGitHubRepos = async (existingContent: string): Promise<string> => {
    this.activeStream = this.activeStream as IStream;

    if (this.activeStream.githubRepos &&
        this.activeStream.githubRepos.length > 0) {
      let response: string = `### Repos\n\n`;

      for (const repo of this.activeStream.githubRepos) {

        const repoLine: string = `- ${this.addLink(
          repo.full_name,
          `https://github.com/${repo.full_name}`
        )}`;
        response = response + `${repoLine}\n`;
      }

      return existingContent + response + `\n`;
    }

    return existingContent;
  };

  private addSponsors = async (existingContent: string): Promise<string> => {
    return existingContent + `## Today's stream brought to you by\n\n`;
  };

  private addLink = (label: string, url: string): string => {
    return `<a href="${url}" target="_blank">${label}</a>`;
  };

  private addMeta = async (): Promise<string> => {
    this.activeStream = this.activeStream as IStream;

    let title: string = this.activeStream.title;
    if (this.activeStream.title.split('- ').length > 1) {
      title = this.activeStream.title.split('- ')[1];
    }

    return `---
layout: post
date: ${moment(this.activeStream.started_at).format('YYYY-MM-DD HH:MM')}
title: "${title}"
image:
description: ""
comments: true
tags: [twitch, stream]
replay:
---\n\n`;
  };
}
