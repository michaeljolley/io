using System;

using TwitchLib.Client;

namespace IO.Core.ChatServices
{
    public class BaseChatService
    {
        private readonly TwitchClient _twitchClient;

        public bool IsAVPaused = false;

        public BaseChatService(TwitchClient twitchClient)
        {
            _twitchClient = twitchClient;
        }

        internal virtual void SendMessage(string message)
        {
            _twitchClient.SendMessage(Constants.TwitchChannel, message);
        }

    }
}
