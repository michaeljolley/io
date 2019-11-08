import Octokit from '@octokit/rest';
import { config, log } from 'io-shared/common';

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

  public async getReposForUser(user: string, type: any = "owner", sort: any = "updated"): Promise<any> {
    return this.octokit.repos.listForUser({
      username: user,
      type: type,
      sort: sort
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

  public async createIssue(repo: string, comment: string, title: string): Promise<any> {
    return this.octokit.issues.create({
      owner: this.githubUsername,
      repo: repo,
      title: title,
      body: comment
    });
  }

  private initializeOctokit(): Octokit {
    return new Octokit({
      auth: config.githubAuthToken,
      userAgent: config.githubUsername,
      // Comment this block and uncomment lower block for debugging
      // WARNING: ADDITIONAL INFO INCLUDES PERSONAL ACCESS TOKEN
      log: {
        debug: (message: any, info?: any) => log('debug', `Message: ${message}` ),
        info: (message: any, info?: any) => log('info', `Message: ${message}}` ),
        warn: (message: any, info?: any) => log('info', `Message: ${message}` ),
        error: (message: any, info?: any) => log('info', `Message: ${message}` )
      }
      /*log: {
        debug: (message: any, info?: any) => log('debug', `Message: ${message}, Additional Info: ${info ? JSON.stringify(info) : 'No additional Info'}` ),
        info: (message: any, info?: any) => log('info', `Message: ${message}, Additional Info: ${info ? JSON.stringify(info) : 'No additional Info'}` ),
        warn: (message: any, info?: any) => log('info', `Message: ${message}, Additional Info: ${info ? JSON.stringify(info) : 'No additional Info'}` ),
        error: (message: any, info?: any) => log('info', `Message: ${message}, Additional Info: ${info ? JSON.stringify(info) : 'No additional Info'}` )
      }*/
    });
  }
}
