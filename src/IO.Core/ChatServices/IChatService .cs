using System;
using System.Collections.Generic;
using System.Threading.Tasks;

using TwitchLib.Client.Models;

namespace IO.Core.ChatServices
{
    public interface IChatService
    {
        Task<string> ProcessMessageAsync(ChatMessage chatMessage);

        List<ChatCommand> AvailableCommands();
    }
}
