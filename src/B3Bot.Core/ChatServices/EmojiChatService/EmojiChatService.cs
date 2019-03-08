using System.Collections.Generic;
using System.Threading.Tasks;
using TwitchLib.Client;
using TwitchLib.Client.Models;

using Microsoft.AspNetCore.SignalR;
using B3Bot.Core.Hubs;

namespace B3Bot.Core.ChatServices
{
    public class EmojiChatService : Hub, IChatService
    {
        private IHubContext<OverlayHub> _overlayHubContext { get; }

        public EmojiChatService(IHubContext<OverlayHub> overlayHubContext)
        {
            _overlayHubContext = overlayHubContext;
        }

        public List<ChatCommand> AvailableCommands()
        {
            return null;
        }

        public async Task<bool> ProcessMessageAsync(ChatMessage chatMessage)
        {
            string message = chatMessage.Message;

            if (!string.IsNullOrEmpty(message))
            {
                EmoteSet emoteSet = chatMessage.EmoteSet;
                if (emoteSet != null && emoteSet.Emotes.Count > 0)
                {
                    List<EmoteSet.Emote> emotes = emoteSet.Emotes;

                    foreach (EmoteSet.Emote emote in emotes)
                    {
                        await _overlayHubContext.Clients.All.SendAsync("NewEmoji", emote.ImageUrl);
                        await Task.Delay(300);
                    }

                    return true;
                }
            }
            return false;
        }

    }
}
