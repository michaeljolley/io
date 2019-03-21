using System;

namespace B3Bot.Core
{
    public static class Constants
    {
        public static string TwitchUsername = Environment.GetEnvironmentVariable("twitch_username");
        public static string TwitchAccessToken = Environment.GetEnvironmentVariable("access_token");
        public static string TwitchChannel = Environment.GetEnvironmentVariable("twitch_channel");

        public static string TwitchChannelId = Environment.GetEnvironmentVariable("twitch_channel_id");

        public static string TwitchAPIClientId= Environment.GetEnvironmentVariable("client_id");
        public static string TwitchAPIClientSecret = Environment.GetEnvironmentVariable("client_secret");
    }
}
