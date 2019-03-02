using System;
using Microsoft.Extensions.DependencyInjection;

using TwitchLib.Api;
using TwitchLib.Client;

using B3Bot.Core;
using B3Bot.Core.ChatServices;

namespace B3Bot
{
    class Program
    {
        static void Main(string[] args)
        {
            TwitchClient twitchClient = new TwitchClient();
            TwitchAPI twitchAPI = new TwitchAPI();

            var serviceProvider = new ServiceCollection()
                    .AddSingleton<IChatService, BasicCommandChatService>()
                    .AddSingleton<IChatService, ShoutOutChatService>()
                    .AddSingleton<IChatService, UptimeChatService>()
                    .AddSingleton(twitchAPI)
                    .AddSingleton(twitchClient)
                    .BuildServiceProvider();

            Bot bot = new Bot(serviceProvider);
            Console.ReadLine();
        }
    }
}
