using System.Threading.Tasks;
using Microsoft.AspNetCore.SignalR;

using TwitchLib.Client.Models;
using TwitchLib.PubSub.Events;
using TwitchLib.PubSub.Models.Responses.Messages;

namespace B3Bot.Core.Hubs
{
    public class OverlayHub: Hub
    {
        public async Task NewEmojiAsync(string emojiUrl)
        {
            await Clients.All.SendAsync("NewEmoji", emojiUrl);
        }

        public async Task NewChatMessageAsync(ChatMessage chatMessage)
        {
            await Clients.All.SendAsync("NewChatMessage", chatMessage);
        }

        public async Task NewFollowerAsync(OnFollowArgs follower)
        {
            await Clients.All.SendAsync("NewFollower", follower);
        }

        public async Task NewCheerAsync(OnBitsReceivedArgs bitsReceived)
        {
            await Clients.All.SendAsync("NewCheer", bitsReceived);
        }

        public async Task NewSubscriptionAsync(ChannelSubscription subscription)
        {
            await Clients.All.SendAsync("NewSubscription", subscription);
        }

        public async Task NewHostAsync(OnHostArgs host)
        {
            await Clients.All.SendAsync("NewHost", host);
        }
    }
}
