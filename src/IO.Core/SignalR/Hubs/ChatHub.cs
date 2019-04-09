using System;
using System.Threading.Tasks;
using Microsoft.AspNetCore.SignalR;

using IO.Core.Models;

namespace IO.Core.SignalR
{
    /// <summary>
    /// Used as the hub to send messages regarding messages in Twitch chat
    /// </summary>
    public class ChatHub : Hub<IChatHubClient>
    {
        /// <summary>
        /// Broadcasts the provided chat message to clients of the hub
        /// </summary>
        /// <param name="chatHubMessage">Message received from Twitch IRC chat</param>
        public async Task BroadcastChatMessage(ChatHubMessage chatHubMessage)
        {
            await Clients.All.ReceiveChatMessage(chatHubMessage);
        }

        /// <summary>
        /// Broadcasts the provided url of the emote received
        /// </summary>
        /// <param name="emoteUrl">Url of the emote in a Twitch IRC message</param>
        public async Task BroadcastEmote(string emoteUrl)
        {
            await Clients.All.ReceiveEmote(emoteUrl);
        }
    }
}
