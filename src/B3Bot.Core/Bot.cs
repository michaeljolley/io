using System;
using System.Collections.Generic;
using Microsoft.Extensions.DependencyInjection;

using TwitchLib.Api;
using TwitchLib.Client;
using TwitchLib.Client.Enums;
using TwitchLib.Client.Events;
using TwitchLib.Client.Models;

using B3Bot.Core.ChatServices;
using B3Bot.Core.TimedServices;
using Microsoft.Extensions.Hosting;
using System.Threading;
using System.Threading.Tasks;

namespace B3Bot.Core
{
    public class Bot : IHostedService
    {
        private TwitchClient twitchClient;
        private TwitchAPI twitchAPI;

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

            ConnectionCredentials credentials = new ConnectionCredentials(Constants.TwitchUsername, Constants.TwitchAccessToken);
            twitchClient.Initialize(credentials, Constants.TwitchChannel);

            twitchClient.OnLog += Client_OnLog;
            twitchClient.OnJoinedChannel += Client_OnJoinedChannel;
            twitchClient.OnMessageReceived += Client_OnMessageReceivedAsync;
            twitchClient.OnWhisperReceived += Client_OnWhisperReceived;
            twitchClient.OnNewSubscriber += Client_OnNewSubscriber;
            twitchClient.OnConnected += Client_OnConnected;

            twitchClient.Connect();

            twitchAPI.Settings.ClientId = Constants.TwitchAPIClientId;
            twitchAPI.Settings.AccessToken = Constants.TwitchAPIAccessToken;
        }

        private void Client_OnLog(object sender, OnLogArgs e)
        {
            Console.WriteLine($"{e.DateTime.ToString()}: {e.BotUsername} - {e.Data}");
        }

        private void Client_OnConnected(object sender, OnConnectedArgs e)
        {
            Console.WriteLine($"Connected to {e.AutoJoinChannel}");
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
