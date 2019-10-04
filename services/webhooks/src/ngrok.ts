import ngrok from 'ngrok';

import { config, log } from 'io-shared/common';

export class NGrok {

  public async getUrl(): Promise<string> {
    return new Promise((resolve: any, reject: any) => {
      ngrok.connect({
        addr: 8800,
        authtoken: config.ngrokAuthToken,
        bind_tls: false,
        proto: 'http',
        onLogEvent: (data: string) => log('info', data)
      })
      .then((ngrokUrl: string) => resolve(ngrokUrl))
      .catch((err: any) => reject(err));
    });
  }

  public async releaseUrl(url: string): Promise<void> {
    await ngrok.disconnect(url);
  }

  public async kill(): Promise<void> {
    await ngrok.kill();
  }
}
