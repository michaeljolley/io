# IO

[![Build status](https://dev.azure.com/io-bot/io-bot/_apis/build/status/io-bot%20-%20CI)](https://dev.azure.com/io-bot/io-bot/_build/latest?definitionId=1)

### What is this?

IO is a chat & overlay bot for Twitch using ASPNET core & SignalR to communicate with the Twitch API, PubSub & IRC Chat.  IO runs in a Linux Docker container.

### How do I use it?

IO uses environment variables for sensitive information.  Any variable mentioned below with `access_token` in the name can be retrieved at [https://twitchapps.com/tmi/](https://twitchapps.com/tmi/).

Also, the variables prefixed with `chatbot` can be the same as the corresponding variables with `twitch_channel` if you don't use a separate account for your chat bot.

Name  |  Description
-- | --
chatbot_access_token | OAuth access token for the chatbot user
chatbot_username | Username of the chatbot user
client_id | ClientId of the Twitch app registered [https://dev.twitch.tv](https://dev.twitch.tv)
client_secret | Client secret of Twitch app
refreshMilliseconds | Frequency in milliseconds to check for updates to follower count, viewer count and last follower
twitch_channel | Username of the Twitch channel
twitch_channel_access_token | Access token of the channel user
twitch_channel_id | Twitch identifier for the channel user