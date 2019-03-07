using Microsoft.AspNetCore.SignalR;
using System.Threading.Tasks;

namespace B3Bot.Core.Hubs
{
    public class OverlayHub: Hub
    {
        public async Task NewEmojiAsync(string emojiUrl)
        {
            await Clients.All.SendAsync("NewEmoji", emojiUrl);
        }
    }
}
