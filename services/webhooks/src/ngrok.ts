import ngrok from 'ngrok';

import { config } from '@shared/common';

export class NGrok {

  public async getUrl(): Promise<string> {
    return new Promise((resolve: any, reject: any) => {
      ngrok.connect({
        addr: 8800,
        authtoken: config.ngrokAuthToken
      })
      .then((ngrokUrl: string) => resolve(ngrokUrl))
      .catch((err: any) => reject(err));
    });
  }

  public async releaseUrl(url: string): Promise<void> {
    return await ngrok.disconnect(url);
  }
}
