using System;
using System.Threading.Tasks;

using IO.Core.Models;

namespace IO.Core.SignalR
{
    public interface IChatHubClient
    {
        Task ReceiveChatMessage(ChatHubMessage chatHubMessage);

        Task ReceiveEmote(string emoteUrl);
    }
}