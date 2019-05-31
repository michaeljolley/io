export class Emote {
  public emoteId: string;
  public emoteImageTag: string;
  public start: number;
  public end: number;

  constructor(emoteId: string, position: string) {
    this.emoteId = emoteId;
    this.emoteImageTag = `<img class='emote' src='https://static-cdn.jtvnw.net/emoticons/v1/${emoteId}/1.0'/>`;

    const p = position.split('-');
    this.start = +p[0];
    this.end = +p[1];
  }
}
