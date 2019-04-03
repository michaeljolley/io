using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

using TwitchLib.Api;
using TwitchLib.Client;
using TwitchLib.Client.Enums;
using TwitchLib.Client.Events;
using TwitchLib.Client.Models;
using TwitchLib.Communication.Events;

using IO.Core.ChatServices;
using IO.Core.TimedServices;
using IO.Core.Hubs;
using IO.Core.Models;

namespace IO.Core
{
    public class IoBot : IHostedService
    {
        private readonly IServiceProvider serviceProvider;
        private IHubContext<IoHub> _overlayHubContext { get; }
        private TwitchClient twitchClient;
        private TwitchAPI twitchAPI;
        private StreamAnalytics _streamAnalytics;

        private bool isShuttingDown;

        public IoBot(IServiceProvider applicationServiceProvider, IHubContext<IoHub> overlayHubContext)
        {
            serviceProvider = applicationServiceProvider;
            _overlayHubContext = overlayHubContext;
            _streamAnalytics = serviceProvider.GetService<StreamAnalytics>();

            ConfigureBot();
        }

        private void ConfigureBot()
        {
            twitchClient = serviceProvider.GetService<TwitchClient>();
            twitchAPI = serviceProvider.GetService<TwitchAPI>();

            ConnectionCredentials credentials = new ConnectionCredentials(Constants.TwitchChatBotUsername, Constants.TwitchChatBotAccessToken);
            twitchClient.Initialize(credentials, Constants.TwitchChannel);

            #region Client Registrations

            twitchClient.OnLog += Client_OnLog;
            twitchClient.OnJoinedChannel += Client_OnJoinedChannel;
            twitchClient.OnConnected += Client_OnConnected;
            twitchClient.OnDisconnected += Client_OnDisconnected;

            twitchClient.OnMessageReceived += Client_OnMessageReceivedAsync;
            twitchClient.OnWhisperReceived += Client_OnWhisperReceived;
            twitchClient.OnRaidNotification += Client_OnRaidNotification;
            twitchClient.OnNewSubscriber += Client_OnNewSubscriber;

            #endregion

            twitchClient.Connect();

            twitchAPI.Settings.ClientId = Constants.TwitchAPIClientId;
            twitchAPI.Settings.Secret = Constants.TwitchAPIClientSecret;
            twitchAPI.Settings.AccessToken = Constants.TwitchChannelAccessToken;
        }

        #region Client Methods

        private void Client_OnLog(object sender, OnLogArgs e)
        {
            Console.WriteLine($"{e.DateTime.ToString()}: {e.BotUsername} - {e.Data}");
        }

        private void Client_OnConnected(object sender, OnConnectedArgs e)
        {
            Console.WriteLine($"Connected to {e.AutoJoinChannel}");
        }

        private void Client_OnDisconnected(object sender, OnDisconnectedEventArgs e)
        {
            Console.WriteLine($"Disconnected from chat");
            
            // if not shutting down on purpose, reconnect
            if (!isShuttingDown)
            {
                twitchClient.Connect();
            }
        }

        private void Client_OnJoinedChannel(object sender, OnJoinedChannelArgs e)
        {
            //IEnumerable<ITimedService> timedServices = serviceProvider.GetServices<ITimedService>();
         
            //foreach (ITimedService timedService in timedServices)
            //{
            //    timedService.Initialize();
            //}
        }

        private async void Client_OnMessageReceivedAsync(object sender, OnMessageReceivedArgs e)
        {
            IEnumerable<IChatService> chatServices = serviceProvider.GetServices<IChatService>();
            string botResponse = string.Empty;

            foreach (IChatService chatService in chatServices)
            {
                botResponse = await chatService.ProcessMessageAsync(e.ChatMessage);

                if (!string.IsNullOrEmpty(botResponse))
                {
                    break;
                }
            }

            await _overlayHubContext.Clients.All.SendAsync("ReceiveNewChatMessage", new ChatHubMessage(e.ChatMessage));

            if (!string.IsNullOrEmpty(botResponse))
            {
                ChatHubMessage chatHubMessage = new ChatHubMessage(botResponse);
                await _overlayHubContext.Clients.All.SendAsync("ReceiveNewChatMessage", chatHubMessage);
            }

            EmoteSet emoteSet = e.ChatMessage.EmoteSet;
            if (emoteSet != null && emoteSet.Emotes.Count > 0)
            {
                List<EmoteSet.Emote> emotes = emoteSet.Emotes;

                foreach (EmoteSet.Emote emote in emotes)
                {
                    await _overlayHubContext.Clients.All.SendAsync("ReceiveNewEmoji", emote.ImageUrl);
                    await Task.Delay(500);
                }
            }
        }

        private void Client_OnWhisperReceived(object sender, OnWhisperReceivedArgs e)
        {
            twitchClient.SendWhisper(e.WhisperMessage.Username, $"Hey {e.WhisperMessage.Username}! I'm a bot.  I'm not great at whispering.");
        }

        private async void Client_OnNewSubscriber(object sender, OnNewSubscriberArgs e)
        {
            if (e.Subscriber.SubscriptionPlan == SubscriptionPlan.Prime)
            {
                twitchClient.SendMessage(e.Channel, $"{e.Subscriber.DisplayName}, thanks for your Prime subscription!");
            }
            else
            { 
                twitchClient.SendMessage(e.Channel, $"{e.Subscriber.DisplayName}, thanks so much for the sub!");
            }

            StreamUserModel lastSubscriber = await _streamAnalytics.GetLastSubscriberAsync();
            await _overlayHubContext.Clients.All.SendAsync("ReceiveNewSubscription", lastSubscriber);
        }

        private void Client_OnRaidNotification(object sender, OnRaidNotificationArgs e)
        {
        }

        #endregion

        public Task StartAsync(CancellationToken cancellationToken)
        {
            while (true)
            {
                if (cancellationToken.IsCancellationRequested)
                {
                    isShuttingDown = true;
                    break;
                }
            }
            return Task.CompletedTask;
        }

        public Task StopAsync(CancellationToken cancellationToken)
        {
            isShuttingDown = true;
            if (twitchClient.IsConnected)
            {
                twitchClient.Disconnect();
            }

            return Task.CompletedTask;
        }
    }
}
