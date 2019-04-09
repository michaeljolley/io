using System;
using System.Linq;
using System.Threading.Tasks;

using TwitchLib.PubSub.Events;

using IO.Core.Models;

namespace IO.Core
{
    public partial class IoBot
    {
        public void ConfigurePubSub()
        {
            _twitchPubSub.OnPubSubServiceConnected += onPubSubServiceConnected;
            _twitchPubSub.OnListenResponse += onListenResponse;
            _twitchPubSub.OnPubSubServiceError += onPubSubServiceError;
            _twitchPubSub.OnPubSubServiceClosed += onPubSubServiceClosed;

            _twitchPubSub.OnBitsReceived += async (sender, e) =>
            {
                await OnBitsReceived(sender, e);
            };
            _twitchPubSub.OnChannelSubscription += async (sender, e) =>
            {
                await OnChannelSubscription(sender, e);
            };
            _twitchPubSub.OnFollow += async (sender, e) =>
            {
                await OnFollow(sender, e);
            };

            _twitchPubSub.Connect();
        }

        private void onPubSubServiceConnected(object sender, EventArgs e)
        {
            _twitchPubSub.ListenToFollows(Constants.TwitchChannelId);
            _twitchPubSub.ListenToBitsEvents(Constants.TwitchChannelId);
            _twitchPubSub.ListenToSubscriptions(Constants.TwitchChannelId);

            _twitchPubSub.SendTopics(Constants.TwitchChannelAccessToken);
        }

        private void onListenResponse(object sender, OnListenResponseArgs e)
        {
            if (!e.Successful)
            {
                Console.WriteLine($"Failed to listen! Response: {e.Response.Error}");
            }
        }

        private void onPubSubServiceClosed(object sender, EventArgs e)
        {
            Task.Delay(5000).Wait();
            _twitchPubSub.Connect();
        }

        private void onPubSubServiceError(object sender, OnPubSubServiceErrorArgs e)
        {
            Console.WriteLine(e.Exception.Message);
        }

        private async Task OnFollow(object sender, OnFollowArgs e)
        {
            StreamUserModel newFollower = _knownUsers.FirstOrDefault(f => f.Id.Equals(e.UserId, StringComparison.InvariantCultureIgnoreCase));
            if (newFollower == null)
            {
                newFollower = await _streamAnalytics.GetUserAsync(e.UserId);
                AddKnownUser(newFollower);
            }

            await BroadcastNewFollower(newFollower);
        }

        private async Task OnBitsReceived(object sender, OnBitsReceivedArgs e)
        {
            await BroadcastNewCheer(e);
        }

        private async Task OnChannelSubscription(object sender, OnChannelSubscriptionArgs e)
        {
            await BroadcastNewSubscriber(e.Subscription);
        }
    }
}
