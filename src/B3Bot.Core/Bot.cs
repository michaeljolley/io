using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

using TwitchLib.Api;
using TwitchLib.Client;
using TwitchLib.Client.Enums;
using TwitchLib.Client.Events;
using TwitchLib.Client.Models;
using TwitchLib.Communication.Events;

using B3Bot.Core.ChatServices;
using B3Bot.Core.TimedServices;
using TwitchLib.PubSub;
using TwitchLib.PubSub.Events;

namespace B3Bot.Core
{
    public class Bot : IHostedService
    {
        private TwitchClient twitchClient;
        private TwitchAPI twitchAPI;
        private static TwitchPubSub twitchPubSub;

        private readonly IServiceProvider serviceProvider;

        public Bot(IServiceProvider applicationServiceProvider)
        {
            serviceProvider = applicationServiceProvider;

            ConfigureBot();
        }

        private void ConfigureBot()
        {
            twitchClient = serviceProvider.GetService<TwitchClient>();
            twitchAPI = serviceProvider.GetService<TwitchAPI>();
            twitchPubSub = serviceProvider.GetService<TwitchPubSub>();

            ConnectionCredentials credentials = new ConnectionCredentials(Constants.TwitchUsername, Constants.TwitchAccessToken);
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

            #region PubSub Registrations

            //twitchPubSub.OnPubSubServiceConnected += onPubSubServiceConnected;
            //twitchPubSub.OnListenResponse += onListenResponse;
            //twitchPubSub.OnStreamUp += onStreamUp;
            //twitchPubSub.OnStreamDown += onStreamDown;

            //twitchPubSub.OnFollow += OnFollow;
            //twitchPubSub.OnBitsReceived += OnBitsReceived;
            //twitchPubSub.OnChannelSubscription += OnChannelSubscription;
            //twitchPubSub.OnHost += OnHost;

            #endregion

            twitchClient.Connect();

            twitchAPI.Settings.ClientId = Constants.TwitchAPIClientId;
            twitchAPI.Settings.Secret = Constants.TwitchAPIClientSecret;
            twitchAPI.Settings.AccessToken = Constants.TwitchAccessToken;
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
        }

        private void Client_OnJoinedChannel(object sender, OnJoinedChannelArgs e)
        {
            IEnumerable<ITimedService> timedServices = serviceProvider.GetServices<ITimedService>();
         
            foreach (ITimedService timedService in timedServices)
            {
                timedService.Initialize();
            }
        }

        private async void Client_OnMessageReceivedAsync(object sender, OnMessageReceivedArgs e)
        {
            IEnumerable<IChatService> chatServices = serviceProvider.GetServices<IChatService>();
            bool isProcessed = false;

            foreach (IChatService chatService in chatServices)
            {
                isProcessed = await chatService.ProcessMessageAsync(e.ChatMessage);

                if (isProcessed)
                {
                    break;
                }
            }
        }

        private void Client_OnWhisperReceived(object sender, OnWhisperReceivedArgs e)
        {
            twitchClient.SendWhisper(e.WhisperMessage.Username, $"Hey {e.WhisperMessage.Username}! I'm a bot.  I'm not great at whispering.");
        }

        private void Client_OnNewSubscriber(object sender, OnNewSubscriberArgs e)
        {
            if (e.Subscriber.SubscriptionPlan == SubscriptionPlan.Prime)
            {
                twitchClient.SendMessage(e.Channel, $"{e.Subscriber.DisplayName}, thanks for your Prime subscription!");
            }
            else
            { 
                twitchClient.SendMessage(e.Channel, $"{e.Subscriber.DisplayName}, thanks so much for the sub!");
            }
        }

        private void Client_OnRaidNotification(object sender, OnRaidNotificationArgs e)
        {
        }

        #endregion

        #region PubSub Methods

        private static void onPubSubServiceConnected(object sender, EventArgs e)
        {
            twitchPubSub.SendTopics();
        }

        private static void onListenResponse(object sender, OnListenResponseArgs e)
        {
            if (!e.Successful)
            {
                Console.WriteLine($"Failed to listen! Response: {e.Response}");
            }
        }

        private static void onStreamUp(object sender, OnStreamUpArgs e)
        {
            Console.WriteLine($"Stream just went up! Play delay: {e.PlayDelay}, server time: {e.ServerTime}");
        }

        private static void onStreamDown(object sender, OnStreamDownArgs e)
        {
            Console.WriteLine($"Stream just went down! Server time: {e.ServerTime}");
        }

        private static void OnFollow(object sender, OnFollowArgs e)
        {
            Console.WriteLine($"Followed by: {e.DisplayName}");
        }

        private static void OnBitsReceived(object sender, OnBitsReceivedArgs e)
        {
            Console.WriteLine($"{e.BitsUsed} bits received from {e.Username}");
        }

        private static void OnChannelSubscription(object sender, OnChannelSubscriptionArgs e)
        {
            Console.WriteLine($"Subscription by: ");
        }

        private static void OnHost(object sender, OnHostArgs e)
        {
            Console.WriteLine($"Hosted by {e.HostedChannel}");
        }

        #endregion

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
            if (twitchClient.IsConnected)
            {
                twitchClient.Disconnect();
            }

            return Task.CompletedTask;
        }
    }
}
