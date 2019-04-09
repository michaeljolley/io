using System;
using System.Threading.Tasks;

using TwitchLib.Client.Events;
using TwitchLib.PubSub.Events;
using TwitchLib.PubSub.Models.Responses.Messages;

using IO.Core.Models;

namespace IO.Core.SignalR
{
    public interface IAlertHubClient
    {
        Task ReceiveNewSubscriber(ChannelSubscription newChannelSubscription);
        Task ReceiveNewFollower(StreamUserModel newFollower);
        Task ReceiveNewCheer(OnBitsReceivedArgs onBitsReceivedArgs);
        Task ReceiveNewRaid(OnRaidNotificationArgs onRaidNotificationArgs);
    }
}