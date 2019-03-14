using System.Threading.Tasks;
using Microsoft.AspNetCore.SignalR;

using TwitchLib.Client.Models;

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
    }
}
