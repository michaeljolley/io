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
    /// Used as the hub to send messages regarding alerts
    /// </summary>
    public class AlertHub : Hub<IAlertHubClient>
    {
        public async Task BroadcastNewFollower(StreamUserModel newFollower)
        {
            await Clients.All.ReceiveNewFollower(newFollower);
        }

        public async Task BroadcastNewCheer(OnBitsReceivedArgs onBitsReceivedArgs)
        {
            await Clients.All.ReceiveNewCheer(onBitsReceivedArgs);
        }

        public async Task BroadcastNewRaid(OnRaidNotificationArgs onRaidNotificationArgs)
        {
            await Clients.All.ReceiveNewRaid(onRaidNotificationArgs);
        }

        public async Task BroadcastNewSubscriber(ChannelSubscription newChannelSubscription)
        {
            await Clients.All.ReceiveNewSubscriber(newChannelSubscription);
        }
    }
}
