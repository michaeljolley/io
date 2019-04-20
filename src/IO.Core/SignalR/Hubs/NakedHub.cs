using System;
using System.Threading.Tasks;
using Microsoft.AspNetCore.SignalR;

using IO.Core.Models;

namespace IO.Core.SignalR
{
    /// <summary>
    /// Used as the hub to send messages regarding messages in Twitch chat
    /// </summary>
    public class NakedHub : Hub<INakedClient>
    {
        public async Task BroadcastToggleNaked()
        {
            await Clients.All.ReceiveToggleNaked();
        }

        public async Task BroadcastToggleNakedActive(bool isActive)
        {
            await Clients.All.ReceiveToggleActive(isActive);
        }
    }
}
