using System;
using System.Collections.Generic;
using System.Linq;
using Microsoft.Extensions.DependencyInjection;

using TwitchLib.Client;
using TwitchLib.Client.Enums;
using TwitchLib.Client.Events;
using TwitchLib.Client.Models;

using B3Bot.Core.ChatServices;

namespace B3Bot.Core
{
    public class Bot
    {
        private readonly TwitchClient twitchClient;
     
        private readonly IServiceProvider serviceProvider;

        public Bot(IServiceProvider applicationServiceProvider)
        {
            serviceProvider = applicationServiceProvider;

            ConnectionCredentials credentials = new ConnectionCredentials(Constants.TwitchUsername, Constants.TwitchAccessToken);

            twitchClient = applicationServiceProvider.GetService<TwitchClient>();

            twitchClient.Initialize(credentials, Constants.TwitchChannel);

            twitchClient.OnLog += Client_OnLog;
            twitchClient.OnJoinedChannel += Client_OnJoinedChannel;
            twitchClient.OnMessageReceived += Client_OnMessageReceived;
            twitchClient.OnWhisperReceived += Client_OnWhisperReceived;
            twitchClient.OnNewSubscriber += Client_OnNewSubscriber;
            twitchClient.OnConnected += Client_OnConnected;
            
            twitchClient.Connect();
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
            twitchClient.SendMessage(e.Channel, "Hi everyone! B3 engaged.  Enjoy the stream!");
        }

        private void Client_OnMessageReceived(object sender, OnMessageReceivedArgs e)
        {
            IEnumerable<IChatService> chatServices = serviceProvider.GetServices<IChatService>();
            foreach(IChatService chatService in chatServices)
            {
                chatService.ProcessMessage(e.ChatMessage);
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
    }
}
