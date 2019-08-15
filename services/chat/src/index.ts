import "module-alias/register";

import { TwitchChat } from './twitch-chat';

const twitchChat: TwitchChat = new TwitchChat();

twitchChat.connect();
