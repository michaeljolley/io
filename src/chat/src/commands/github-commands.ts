import { ChatUserstate } from 'tmi.js';
import FuzzySearch from 'fuzzy-search';

import { IUserInfo, IProjectSettings, IRepository, IIssue } from '@shared/models';
import { IBaseEventArg } from '@shared/event_args/index';
import { isBroadcaster, isMod, get, post, log } from '@shared/common';

export const repoCommand = (
  message: string,
  user: ChatUserstate,
  userInfo: IUserInfo,
  projectSettings: IProjectSettings = {},
  twitchChatFunc: (message: string) => void,
  emitMessageFunc: (event: string, payload: IBaseEventArg) => void
): IProjectSettings | boolean => {
  if (
    message === undefined ||
    message.length === 0
  ) {
    return false;
  }

  const lowerMessage = message.toLocaleLowerCase().trim();
  const args = message.split(' ');
  const firstWord = lowerMessage.split(' ')[0];

  if (firstWord !== '!repo') {
    return false;
  }

  if ((!isMod(user) && !isBroadcaster(user)) || args.length === 1) {
    if (twitchChatFunc) {
      twitchChatFunc(
        `We are currently working on ${projectSettings.repo ? projectSettings.repo : "absolutely nothing"}`
      );
    }
    return true;
  }

  if (args[1] === "reset") {
    projectSettings.repo = undefined;
  } else {
    if (projectSettings.repositories && projectSettings.repositories.find((repo: any) => repo.name.toLocaleLowerCase() === args[1].toLocaleLowerCase())) {
      projectSettings.repo = args[1];
    } else {
      if (twitchChatFunc) {
        const fuzzy = new FuzzySearch(projectSettings.repositories as IRepository[], ['name'], {
          caseSensitive: false
        });
        const results = fuzzy.search(args[1]);
        let repos = results.map((item: any) => item['name']);
        let response = `Repo ${args[1]} doesn't exist.`;
        if (repos && repos.length > 0) {
          response += `I found ${repos.join(',')}`
        } else {
          response += "Do you need to run !updaterrepos?";
        }
        twitchChatFunc(response);
        return true;
      }
    }
  }

  if (twitchChatFunc) {
    twitchChatFunc(
      `Updated project settings. We are currently working on ${projectSettings.repo ? projectSettings.repo : "absolutely nothing"}`
    );
  }

  return projectSettings ? projectSettings : true;
};

export const issueCommand = (
  message: string,
  user: ChatUserstate,
  userInfo: IUserInfo,
  projectSettings: IProjectSettings = {},
  twitchChatFunc: (message: string) => void,
  emitMessageFunc: (event: string, payload: IBaseEventArg) => void
): IProjectSettings | boolean => {

  if (
    message === undefined ||
    message.length === 0
  ) {
    return false;
  }

  const lowerMessage = message.toLocaleLowerCase().trim();
  const args = message.split(' ');
  const firstWord = lowerMessage.split(' ')[0];

  if (firstWord !== '!issue') {
    return false;
  }

  if ((!isMod(user) && !isBroadcaster(user)) || args.length === 1) {
    if (twitchChatFunc) {
      twitchChatFunc(
        `We are currently working on ${projectSettings.issue ? (projectSettings.issue.number + " - " + projectSettings.issue.title) : "no issues"}`
      );
    }
    return true;
  }

  if (args[1] === "reset") {
    projectSettings.issue = undefined;
  } else {
    if (projectSettings.repo === undefined) {
      if (twitchChatFunc) {
        twitchChatFunc(
          `Please set a repo 
          by issuing command !repo <repoName> before setting an issue.`
        );
      }
    } else {
      let repo = (projectSettings.repositories && projectSettings.repo) ?
        projectSettings.repositories.find((repo: any) => repo.name === projectSettings.repo) : undefined;
      if (args.length === 2 && !isNaN(+args[1])) {
        projectSettings.issue = repo ? repo.issues.find((issue: any) => issue.number === +args[1]) : undefined;
        if (!projectSettings.issue) {
          if (twitchChatFunc) {
            twitchChatFunc(
              `No issues matching that number were found`
            );
          }
          return true;
        }
      } else if (repo) {
        const fuzzy = new FuzzySearch(repo.issues as IIssue[], ['title'], {
          caseSensitive: false
        });
        const results = fuzzy.search(args.slice(1).join(' '));
        if (results.length === 1) {
          projectSettings.issue = results[0];
        } else {
          projectSettings.issue = undefined;
          if (twitchChatFunc) {
            twitchChatFunc(
              `Issues matching search: ${results.map((item: any) => item['title']).join(', ')}`
            );
            return true;
          }
        }
      }
    }
  }


  if (twitchChatFunc && projectSettings.issue) {
    twitchChatFunc(
      `Updated project settings. Currently working on issue # ${projectSettings.issue.number + " - " + projectSettings.issue.title}`
    );
  } else {
    twitchChatFunc(
      'Updated project settings. We are currently not working on an issue.'
    );
  }

  return projectSettings ? projectSettings : true;
};

export const contributeCommand = async (
  message: string,
  user: ChatUserstate,
  userInfo: IUserInfo,
  projectSettings: IProjectSettings,
  twitchChatFunc: (message: string) => void,
  emitMessageFunc: (event: string, payload: IBaseEventArg) => void
): Promise<IProjectSettings | boolean> => {

  if (
    message === undefined ||
    message.length === 0
  ) {
    return false;
  }

  const lowerMessage = message.toLocaleLowerCase().trim();
  const args = message.split(' ');
  const firstWord = lowerMessage.split(' ')[0];

  if (firstWord !== '!contributor') {
    return false;
  }

  if (!isMod(user) && !isBroadcaster(user)) {
    return true;
  }

  if (projectSettings && projectSettings.repo === undefined) {
    if (twitchChatFunc) {
      twitchChatFunc('Repo needs to be set to add a contributor. Run !repo <yourrepo> to set.');
    }
    return true;
  }

  if (args.length >= 3) {
    let url;

    if (projectSettings && projectSettings.issue) {
      url = `http://api/issues/${projectSettings.issue.number}/comment`;
    } else {
      url = `http://api/issues/new`;
      let comment = "Opening to add contributor";
      await post(url, { repo: projectSettings.repo, comment: comment }).then((response: any) => {
        if (twitchChatFunc) {
          if (response.status === 201) {
            url = `http://api/issues/${response.data.number}/comment`;
          } else {
            log('info', `Response: ${response}`)
            twitchChatFunc('There was a problem adding the contributor');
            return true;
          }
        }
      });
    }

    let comment = `@all-contributors please add @${args[1]} for `;
    let contributions = args.slice(2);

    comment = comment + contributions.join(',');

    await post(url, { repo: projectSettings.repo, comment: comment }).then((response: any) => {
      if (twitchChatFunc) {
        if (response.status === 201) {
          log('info', `Response: ${response}`)
          twitchChatFunc('Contributor added succesfully');
        } else {
          log('info', `Response: ${response}`)
          twitchChatFunc('There was a problem adding the contributor');
        }
      }
    });
  }
  return projectSettings ? projectSettings : true;
};

export const updateReposCommand = async (
  message: string,
  user: ChatUserstate,
  userInfo: IUserInfo,
  projectSettings: IProjectSettings,
  twitchChatFunc: (message: string) => void,
  emitMessageFunc: (event: string, payload: IBaseEventArg) => void
): Promise<IProjectSettings | boolean> => {

  if (
    message === undefined ||
    message.length === 0
  ) {
    return false;
  }

  const lowerMessage = message.toLocaleLowerCase().trim();
  const firstWord = lowerMessage.split(' ')[0];

  if (firstWord !== '!updaterepos') {
    return false;
  }

  if (!isMod(user) && !isBroadcaster(user)) {
    return true;
  }

  const url = "http://api/repos/full";

  await get(url).then((response: any) => {
    if (twitchChatFunc) {
      if (response.status === 200) {
        log('info', `Response: ${response}`)
        projectSettings.repositories = response.data;
        twitchChatFunc('Repos updated succesfully');
      } else {
        log('info', `Response: ${response}`)
        twitchChatFunc('There was a problem updating the repos');
      }
    }
  });
  return projectSettings ? projectSettings : true;
};
