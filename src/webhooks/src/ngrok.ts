import ngrok from 'ngrok';
import { config } from './common';

export class NGrok {

  public async getUrl(): Promise<string> {
    return await ngrok.connect({
      addr: 80,
      authtoken: config.ngrokAuthToken
    });
  }

  public async releaseUrl(url: string): Promise<void> {
    return await ngrok.disconnect(url);
  }


}
