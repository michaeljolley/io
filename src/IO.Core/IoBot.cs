using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.SignalR.Client;
using Microsoft.Extensions.Hosting;

using TwitchLib.Client;
using TwitchLib.PubSub;

using IO.Core.Models;

namespace IO.Core
{
    public partial class IoBot : IHostedService
    {
        private IServiceProvider _serviceProvider;

        private readonly TwitchClient _twitchClient;
        private readonly StreamAnalytics _streamAnalytics;
        private TwitchPubSub _twitchPubSub = new TwitchPubSub();
        private int _refreshMilliSeconds = Convert.ToInt32(Constants.OverlayRefreshMilliSeconds);

        private List<StreamUserModel> _knownUsers = new List<StreamUserModel>();

        private CancellationToken _cancellationToken;

        private bool isShuttingDown;
        
        public IoBot(TwitchClient twitchClient, StreamAnalytics streamAnalytics, IServiceProvider serviceProvider)
        {
            _streamAnalytics = streamAnalytics;
            _serviceProvider = serviceProvider;
            _twitchClient = twitchClient;
        }

        private async Task ConfigureBotAsync()
        {
            await ConfigureHubsAsync();
            ConfigurePubSub();
            ConfigureChat();
            ConfigurePolling();
        }

        private void AddKnownUser(StreamUserModel newUser)
        {
            if (!_knownUsers.Any(a => a.Id.Equals(newUser.Id, StringComparison.InvariantCultureIgnoreCase)))
            {
                _knownUsers.Add(newUser);
            }
        }

        public async Task StartAsync(CancellationToken cancellationToken)
        {
            _cancellationToken = cancellationToken;

            await ConfigureBotAsync();

            while (true)
            {
                if (_cancellationToken.IsCancellationRequested)
                {
                    break;
                }
            }
        }

        public async Task StopAsync(CancellationToken cancellationToken)
        {
            isShuttingDown = true;
            if (_twitchClient != null && _twitchClient.IsConnected)
            {
                _twitchClient.Disconnect();
            }
            if (_twitchPubSub != null)
            {
                _twitchPubSub.Disconnect();
            }
            if (_timer != null)
            {
                _timer.Dispose();
            }
            //if (_streamStatusCheck != null)
            //{
            //    _streamStatusCheck.Dispose();
            //}
            //if (_followerChatReminder != null)
            //{
            //    _followerChatReminder.Dispose();
            //}
            //if (_discordChatReminder != null)
            //{
            //    _discordChatReminder.Dispose();
            //}
            //if (_questionChatReminder != null)
            //{
            //    _questionChatReminder.Dispose();
            //}
            //if (_primeChatReminder != null)
            //{
            //    _primeChatReminder.Dispose();
            //}
            if (_alertHubConnection != null)
            {
                if (_alertHubConnection.State == HubConnectionState.Connected)
                {
                    await _alertHubConnection.StopAsync();
                }
                await _alertHubConnection.DisposeAsync();
            }
            if (_chatHubConnection != null)
            {
                if (_chatHubConnection.State == HubConnectionState.Connected)
                {
                    await _chatHubConnection.StopAsync();
                }
                await _chatHubConnection.DisposeAsync();
            }
            if (_overlayHubConnection != null)
            {
                if (_overlayHubConnection.State == HubConnectionState.Connected)
                {
                    await _overlayHubConnection.StopAsync();
                }
                await _overlayHubConnection.DisposeAsync();
            }
        }
    }
}
