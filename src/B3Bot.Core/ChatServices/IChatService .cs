
using TwitchLib.Client.Models;

namespace B3Bot.Core.ChatServices
{
    public interface IChatService
    {
        void ProcessMessage(ChatMessage chatMessage);
    }
}
