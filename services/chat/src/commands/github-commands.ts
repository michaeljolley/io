import { ChatUserstate } from 'tmi.js';
import FuzzySearch from 'fuzzy-search';

import {
  IUserInfo,
  IProjectSettings,
  IRepository,
  IIssue
} from '@shared/models';
import { IBaseEventArg } from '@shared/event_args/index';
import { isBroadcaster, isMod, get, post } from '@shared/common';

// !repo : prints to chat current working issue
// !repo <repoName> : searches for repo including <repoName>,
// if no exact matches return fuzzy search results for suggestions
// !repo reset : sets current working repo as undefined
export const repoCommand = (
  message: string,
  user: ChatUserstate,
  userInfo: IUserInfo,
  projectSettings: IProjectSettings,
  twitchChatFunc: (message: string) => void,
  emitMessageFunc: (event: string, payload: IBaseEventArg) => void
): IProjectSettings | boolean => {
  if (message === undefined || message.length === 0) {
    return false;
  }

  const args = message.trim().split(' ');

  if (args[0].toLocaleLowerCase() !== '!repo') {
    return false;
  }

  if ((!isMod(user) && !isBroadcaster(user)) || args.length === 1) {
    sendMessage(
      twitchChatFunc,
      `We are currently working on ${
        projectSettings.repo ? projectSettings.repo : 'absolutely nothing'
      }`
    );
    return true;
  }

  if (args[1] === 'reset') {
    projectSettings.repo = undefined;
    projectSettings.issue = undefined;
  } else {
    // If repo from command matches a public repository for the broadcaster, update the settings
    if (
      projectSettings.repositories &&
      projectSettings.repositories.find(
        (repo: any) =>
          repo.name.toLocaleLowerCase() === args[1].toLocaleLowerCase()
      )
    ) {
      projectSettings.repo = args[1];
    } else {
      // If no match was found, do a fuzzy search, if only one repo matches,
      // set it as the current working repo. If multiple, return possible matches in chat
      const fuzzy = new FuzzySearch(
        projectSettings.repositories as IRepository[],
        ['name'],
        {
          caseSensitive: false
        }
      );
      const results = fuzzy.search(args[1]);
      let repos = results.map((item: any) => item['name']);
      let response = `Repo ${args[1]} doesn't exist.`;
      if (repos && repos.length > 0) {
        response += ` I found ${repos.join(',')}`;
      } else {
        response += ' Do you need to run !updaterrepos?';
      }
      sendMessage(twitchChatFunc, response);
      return true;
    }
  }

  sendMessage(
    twitchChatFunc,
    `Updated project settings. We are currently working on ${
      projectSettings.repo ? projectSettings.repo : 'absolutely nothing'
    }`
  );

  return projectSettings ? projectSettings : true;
};

// !issue : prints to chat the current working issue
// !issue 55 : searches for and adds issue if one matches with that number
// !issue Error when : searches issues for title that includes search phrase
// !issue reset : sets current working issue to undefined
export const issueCommand = (
  message: string,
  user: ChatUserstate,
  userInfo: IUserInfo,
  projectSettings: IProjectSettings,
  twitchChatFunc: (message: string) => void,
  emitMessageFunc: (event: string, payload: IBaseEventArg) => void
): IProjectSettings | boolean => {
  if (message === undefined || message.length === 0) {
    return false;
  }

  const args = message.trim().split(' ');

  if (args[0].toLocaleLowerCase() !== '!issue') {
    return false;
  }

  // If user is not a mod or broadcaster, or if only !issue is passed in
  // respond with the current issue that is being worked on.
  if ((!isMod(user) && !isBroadcaster(user)) || args.length === 1) {
    sendMessage(
      twitchChatFunc,
      `We are currently working on ${
        projectSettings.issue
          ? projectSettings.issue.number + ' - ' + projectSettings.issue.title
          : 'no issues'
      }`
    );
    return true;
  }

  if (args[1] === 'reset') {
    projectSettings.issue = undefined;
  } else {
    // Can't set the working issue without knowing what repo we are in
    if (projectSettings.repo === undefined) {
      sendMessage(
        twitchChatFunc,
        'Repo needs to be set before setting an issue. Run !repo <yourrepo> to set.'
      );
    } else {
      // Get all info for current repo
      let repo =
        projectSettings.repositories && projectSettings.repo
          ? projectSettings.repositories.find(
              (repo: any) => repo.name === projectSettings.repo
            )
          : undefined;
      // If only two arguments and second argument is a number, search by issue number
      if (args.length === 2 && !isNaN(+args[1])) {
        projectSettings.issue = repo
          ? repo.issues.find((issue: any) => issue.number === +args[1])
          : undefined;
        if (!projectSettings.issue) {
          sendMessage(
            twitchChatFunc,
            `No issues matching that number were found`
          );
          return true;
        }
      } else if (repo) {
        // Search issues in current repo by title. If only one is returned,
        // set it as working issue. Otherwise, return any matching issues
        const fuzzy = new FuzzySearch(repo.issues as IIssue[], ['title'], {
          caseSensitive: false
        });
        const results = fuzzy.search(args.slice(1).join(' '));
        if (results.length === 1) {
          projectSettings.issue = results[0];
        } else {
          // Unset the issue is one wasn't returned
          projectSettings.issue = undefined;

          let issues: string[] = [];
          for (let issue of results) {
            issues.push(`#${issue.number}: ${issue.title}`);
          }
          sendMessage(
            twitchChatFunc,
            `Issues matching search: ${issues.join(', ')}`
          );
          return true;
        }
      }
    }
  }

  if (twitchChatFunc && projectSettings.issue) {
    twitchChatFunc(
      `Updated project settings. Currently working on issue # ${projectSettings
        .issue.number +
        ' - ' +
        projectSettings.issue.title}`
    );
  } else {
    twitchChatFunc(
      'Updated project settings. We are currently not working on an issue.'
    );
  }

  return projectSettings ? projectSettings : true;
};

// !contributor <githubUsername> <contributions space separated>
// !contributor MyUser code docs testing
export const contributeCommand = async (
  message: string,
  user: ChatUserstate,
  userInfo: IUserInfo,
  projectSettings: IProjectSettings,
  twitchChatFunc: (message: string) => void,
  emitMessageFunc: (event: string, payload: IBaseEventArg) => void
): Promise<IProjectSettings | boolean> => {
  if (message === undefined || message.length === 0) {
    return false;
  }

  const args = message.trim().split(' ');

  if (args[0].toLocaleLowerCase() !== '!contributor') {
    return false;
  }

  if (!isMod(user) && !isBroadcaster(user)) {
    return true;
  }

  if (projectSettings && projectSettings.repo === undefined) {
    sendMessage(
      twitchChatFunc,
      'Repo needs to be set to add a contributor. Run !repo <yourrepo> to set.'
    );
    return true;
  }

  if (args.length >= 3) {
    let url;
    // If issue is set, add contributor comment to that issue
    // otherwise create a new issue to add contributor
    if (projectSettings && projectSettings.issue) {
      url = `http://api/issues/${projectSettings.issue.number}/comment`;
    } else {
      url = `http://api/issues/new`;
      let comment = 'Opening to add contributor';
      // all-contributor bot doesn't respond to opening issue event
      // so create new issue then add a new comment to that issue
      await post(url, {
        repo: projectSettings.repo,
        comment: comment,
        title: 'Add new contributor'
      }).then((response: any) => {
        if (response.status === 201) {
          url = `http://api/issues/${response.data.number}/comment`;
        } else {
          sendMessage(
            twitchChatFunc,
            'There was a problem adding the contributor'
          );
          return true;
        }
      });
    }

    let comment = `@all-contributors please add @${args[1]} for `;
    let contributions = args.slice(2);

    comment = comment + contributions.join(', ');

    await post(url, { repo: projectSettings.repo, comment: comment }).then(
      (response: any) => {
        if (twitchChatFunc) {
          if (response.status === 201) {
            twitchChatFunc('Contributor added succesfully');
          } else {
            twitchChatFunc('There was a problem adding the contributor');
          }
        }
      }
    );
  }
  return projectSettings ? projectSettings : true;
};

// !updaterepos
// Gets updated repos and issues and adds to projectSettings
export const updateReposCommand = async (
  message: string,
  user: ChatUserstate,
  userInfo: IUserInfo,
  projectSettings: IProjectSettings,
  twitchChatFunc: (message: string) => void,
  emitMessageFunc: (event: string, payload: IBaseEventArg) => void
): Promise<IProjectSettings | boolean> => {
  if (message === undefined || message.length === 0) {
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

  const url = 'http://api/repos/full';

  await get(url).then((response: any) => {
    if (twitchChatFunc) {
      if (response.status === 200) {
        projectSettings.repositories = response.data;
        twitchChatFunc('Repos updated successfully');
      } else {
        twitchChatFunc('There was a problem updating the repos');
      }
    }
  });
  return projectSettings ? projectSettings : true;
};

// This function just cleans up the code a bit where we aren't already doing a check
function sendMessage(twitchChatFunc: Function, message: string) {
  if (twitchChatFunc && message) {
    twitchChatFunc(message);
  }
}
