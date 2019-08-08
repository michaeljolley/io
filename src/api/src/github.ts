import Octokit from '@octokit/rest';
import { config, log } from '@shared/common';

export class Github {
  private octokit: Octokit;
  private githubUsername: string = config.githubUsername;

  constructor() {
    this.octokit = this.initializeOctokit();
    
    this.initializeOctokit();
   }

  public async getRepos(): Promise<any> {
    return this.octokit.repos.list({
      visibility: "public",
      affiliation: "owner",
      sort: "updated"
    });
  }

  public async getIssuesForRepo(repo: string): Promise<any> {
    return this.octokit.issues.listForRepo({
      owner: this.githubUsername,
      repo: repo,
      state: "open"
    });
  }

  public async createComment(repo: string, id: number, comment: string): Promise<any> {
    return this.octokit.issues.createComment({
      owner: this.githubUsername,
      repo: repo,
      issue_number: id,
      body: comment
    });
  }

  private initializeOctokit(): Octokit {
    return new Octokit({
      auth: config.githubAuthToken,
      userAgent: config.githubUsername,

      log: {
        debug: (message: any, info?: any) => log('debug', `Message: ${message}, Additional Info: ${info ? info : 'No additional Info'}` ),
        info: (message: any, info?: any) => log('info', `Message: ${message}, Additional Info: ${info ? info : 'No additional Info'}` ),
        warn: (message: any, info?: any) => log('info', `Message: ${message}, Additional Info: ${info ? info : 'No additional Info'}` ),
        error: (message: any, info?: any) => log('info', `Message: ${message}, Additional Info: ${info ? info : 'No additional Info'}` )
      }
    });
  }
}
