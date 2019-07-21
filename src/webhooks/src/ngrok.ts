import ngrok from 'ngrok';
import { config, log } from './common';

export class NGrok {

  public async getUrl(): Promise<string> {
    return await new Promise((resolve: any) => {
        ngrok.connect({
          addr: 80,
          authtoken: config.ngrokAuthToken
        })
        .then((url: string) => resolve(url))
        .catch((err: any) => {
          log('info', err);
          resolve('');
        });
      });
  }

  public async releaseUrl(url: string): Promise<void> {
    return await ngrok.disconnect(url);
  }
}
