using System.Threading.Tasks;
using Microsoft.AspNetCore.SignalR;

using TwitchLib.Client.Models;
using TwitchLib.PubSub.Events;
using TwitchLib.PubSub.Models.Responses.Messages;

using B3Bot.Core.Models;

namespace B3Bot.Core.Hubs
{
    public class OverlayHub : Hub
    {
        private readonly StreamAnalytics _streamAnalytics;

        private static long _currentFollowerCount;
        private static int _currentViewerCount;
        private static StreamUserModel _lastFollower;
        private static StreamUserModel _lastSubscriber;

        public OverlayHub(StreamAnalytics streamAnalytics)
        {
            _streamAnalytics = streamAnalytics;
        }

        private async Task UpdateFollowerCountAsync()
        {
            _currentFollowerCount = await _streamAnalytics.GetFollowerCountAsync();
        }

        private async Task UpdateViewerCountAsync()
        {
            _currentViewerCount = await _streamAnalytics.GetViewerCountAsync();
        }

        private async Task UpdateLastFollowerAsync()
        {
            _lastFollower = await _streamAnalytics.GetLastFollowerAsync();
        }

        private async Task UpdateLastSubscriberAsync()
        {
            _lastSubscriber = await _streamAnalytics.GetLastSubscriberAsync();
        }

        public async Task RequestFollowerCount()
        {
            if (_currentFollowerCount == 0)
            {
                await UpdateFollowerCountAsync();
            }
            await Clients.Client(Context.ConnectionId).SendAsync("ReceiveFollowerCount", _currentFollowerCount);
        }

        public async Task RequestViewerCount()
        {
            if (_currentViewerCount == 0)
            {
                await UpdateViewerCountAsync();
            }
            await Clients.Client(Context.ConnectionId).SendAsync("ReceiveViewerCount", _currentViewerCount);
        }

        public async Task RequestLastFollower()
        {
            if (_lastFollower == null)
            {
                await UpdateLastFollowerAsync(); 
            }
            await Clients.Client(Context.ConnectionId).SendAsync("ReceiveLastFollower", _lastFollower);
        }

        public async Task RequestLastSubscriber()
        {
            if (_lastSubscriber == null)
            {
                await UpdateLastSubscriberAsync();
            }
            await Clients.Client(Context.ConnectionId).SendAsync("ReceiveLastSubscriber", _lastSubscriber);
        }

        public Task BroadcastNewEmoji(string emojiUrl)
        {
            return Clients.All.SendAsync("ReceiveNewEmoji", emojiUrl);
        }

        public Task BroadcastNewChatMessage(ChatMessage chatMessage)
        {
            return Clients.All.SendAsync("ReceiveNewChatMessage", chatMessage);
        }

        public Task BroadcastFollowerCountChanged(long followerCount)
        {
            _currentFollowerCount = followerCount;
            return Clients.All.SendAsync("ReceiveFollowerCount", _currentFollowerCount);
        }
        
        public Task BroadcastViewerCountChanged(int viewerCount)
        {
            _currentViewerCount = viewerCount;
            return Clients.All.SendAsync("ReceiveViewerCount", _currentViewerCount);
        }

        public Task BroadcastNewFollower(OnFollowArgs follower)
        {
            return Clients.All.SendAsync("ReceiveNewFollower", follower);
        }

        public Task BroadcastCheer(OnBitsReceivedArgs bitsReceived)
        {
            return Clients.All.SendAsync("ReceiveNewCheer", bitsReceived);
        }

        public async Task BroadcastSubscription(ChannelSubscription subscription)
        {
            await UpdateLastSubscriberAsync();
            await Clients.All.SendAsync("ReceiveNewSubscription", _lastSubscriber);
        }

        public Task BroadcastHost(OnHostArgs host)
        {
            return Clients.All.SendAsync("ReceiveNewHost", host);
        }
    }
}
