using System;

namespace IO.Core
{
    public static class Constants
    {
        public static string TwitchChannel = Environment.GetEnvironmentVariable("twitch_channel");
        public static string TwitchChannelId = Environment.GetEnvironmentVariable("twitch_channel_id");
        public static string TwitchChannelAccessToken = Environment.GetEnvironmentVariable("twitch_channel_access_token");

        public static string TwitchChatBotUsername = Environment.GetEnvironmentVariable("chatbot_username");
        public static string TwitchChatBotAccessToken = Environment.GetEnvironmentVariable("chatbot_access_token");


        public static string TwitchAPIClientId= Environment.GetEnvironmentVariable("client_id");
        public static string TwitchAPIClientSecret = Environment.GetEnvironmentVariable("client_secret");

        public static string OverlayRefreshMilliSeconds = Environment.GetEnvironmentVariable("refreshMilliseconds");

        public static string HubOverlayUrl = Environment.GetEnvironmentVariable("hubOverlayUrl");
    }
}
