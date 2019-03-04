using System.Collections.Generic;
using System.Threading.Tasks;

using TwitchLib.Client.Models;

namespace B3Bot.Core.ChatServices
{
    public interface IChatService
    {
        Task<bool> ProcessMessageAsync(ChatMessage chatMessage);

        List<ChatCommand> AvailableCommands();
    }
}
