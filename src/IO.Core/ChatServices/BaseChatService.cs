using IO.Core.Hubs;
using IO.Core.Models;
using Microsoft.AspNetCore.SignalR;
using System;
using System.Collections.Generic;
using System.Text;
using System.Threading.Tasks;
using TwitchLib.Client;
using TwitchLib.Client.Models;

namespace IO.Core.ChatServices
{
    public class BaseChatService
    {
        private readonly TwitchClient _twitchClient;

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
