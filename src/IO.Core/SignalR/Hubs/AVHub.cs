using System;
using System.Threading.Tasks;
using Microsoft.AspNetCore.SignalR;

using IO.Core.Models;
using TwitchLib.PubSub.Events;
using TwitchLib.PubSub.Models.Responses.Messages;
using TwitchLib.Client.Events;

namespace IO.Core.SignalR
{
    /// <summary>
    /// Used as the hub to send messages regarding audio/video clips
    /// </summary>
    public class AVHub : Hub<IAVHubClient>
    {
        public async Task BroadcastNewAudioClip(string filename)
        {
            await Clients.All.ReceiveNewAudioClip(filename);
        }

        public async Task BroadcastNewVideoClip(string filename)
        {
            await Clients.All.ReceiveNewVideoClip(filename);
        }

        public async Task BroadcastStopAudioClips()
        {
            await Clients.All.ReceiveStopAudioClips();
        }

        public async Task BroadcastStopVideoClips()
        {
            await Clients.All.ReceiveStopVideoClips();
        }
    }
}
