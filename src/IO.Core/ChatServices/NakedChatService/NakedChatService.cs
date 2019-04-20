using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Hosting;

using TwitchLib.Client;
using TwitchLib.Client.Models;

namespace IO.Core.ChatServices
{
    public class NakedChatService : BaseChatService, IChatService
    {
        public NakedChatService(TwitchClient applicationTwitchClient) :
            base(applicationTwitchClient)
        { }

        // We're not going to publish these commands in our standard !help list
        public List<ChatCommand> AvailableCommands() => new List<ChatCommand>()
        {
            new ChatCommand("!naked", "!naked {activate/deactivate}", true)
        };

        public async Task<string> ProcessMessageAsync(ChatMessage chatMessage)
        {
            string message = chatMessage.Message;

            if (!string.IsNullOrEmpty(message))
            {
                string[] splitMessage = message.Split(null);

                if (splitMessage[0].Equals("!naked", StringComparison.InvariantCultureIgnoreCase))
                {
                    if (splitMessage.Length > 0 && 
                        (chatMessage.IsModerator || chatMessage.IsBroadcaster))
                    {
                        switch (splitMessage[1])
                        {
                            case "activate":
                                return "naked:activate";
                            case "deactivate":
                                return "naked:deactivate";
                            default:
                                break;
                        }
                    }
                    else
                    {
                        return "naked:";
                    }
                }
            }
            return string.Empty;
        }
    }
}
