using B3Bot.Core.Hubs;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Hosting;
using System;
using System.Threading;
using System.Threading.Tasks;
using TwitchLib.PubSub;
using TwitchLib.PubSub.Events;

namespace B3Bot.Core.PubSub
{
    public class BotPubSub : IHostedService
    {
        private static IHubContext<OverlayHub> _overlayHubContext;
        private static TwitchPubSub _twitchPubSub = new TwitchPubSub();

        public BotPubSub(IHubContext<OverlayHub> overlayHubContext)
        {
            _overlayHubContext = overlayHubContext;

            ConfigurePubSub();
        }

        public void ConfigurePubSub()
        {
            _twitchPubSub.OnPubSubServiceConnected += onPubSubServiceConnected;
            _twitchPubSub.OnListenResponse += onListenResponse;

            _twitchPubSub.OnFollow += OnFollow;
            _twitchPubSub.OnBitsReceived += OnBitsReceived;
            _twitchPubSub.OnChannelSubscription += OnChannelSubscription;

            _twitchPubSub.Connect();
        }

        #region PubSub Methods

        private static void onPubSubServiceConnected(object sender, EventArgs e)
        {
            _twitchPubSub.ListenToFollows(Constants.TwitchChannelId);
            _twitchPubSub.ListenToBitsEvents(Constants.TwitchChannelId);
            _twitchPubSub.ListenToSubscriptions(Constants.TwitchChannelId);

            _twitchPubSub.SendTopics(Constants.TwitchAccessToken);
        }

        private static void onListenResponse(object sender, OnListenResponseArgs e)
        {
            if (!e.Successful)
            {
                Console.WriteLine($"Failed to listen! Response: {e.Response.Error}");
            }
        }

        private static async void OnFollow(object sender, OnFollowArgs e)
        {
            await _overlayHubContext.Clients.All.SendAsync("NewFollower", e);
        }

        private static async void OnBitsReceived(object sender, OnBitsReceivedArgs e)
        {
            await _overlayHubContext.Clients.All.SendAsync("NewCheer", e);
        }

        private static async void OnChannelSubscription(object sender, OnChannelSubscriptionArgs e)
        {
            await _overlayHubContext.Clients.All.SendAsync("NewSubscription", e.Subscription);
        }

        public Task StartAsync(CancellationToken cancellationToken)
        {
            while (true)
            {
                if (cancellationToken.IsCancellationRequested)
                {
                    break;
                }
            }
            return Task.CompletedTask;
        }

        public Task StopAsync(CancellationToken cancellationToken)
        {
            return Task.CompletedTask;
        }

        #endregion
    }
}

