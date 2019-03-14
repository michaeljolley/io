using System.Collections.Generic;
using System.Threading.Tasks;
using TwitchLib.Client.Models;

using Microsoft.AspNetCore.SignalR;
using B3Bot.Core.Hubs;
using B3Bot.Core.Models;

namespace B3Bot.Core.ChatServices
{
    public class OverlayChatService : Hub, IChatService
    {
        private IHubContext<OverlayHub> _overlayHubContext { get; }

        public OverlayChatService(IHubContext<OverlayHub> overlayHubContext)
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
                // Send chat message to the overlay to display
                await _overlayHubContext.Clients.All.SendAsync("NewChatMessage", new ChatHubMessage(chatMessage));

                // Send any emotes to the window as well
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
