using System;
using Microsoft.Extensions.DependencyInjection;

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

            var serviceProvider = new ServiceCollection()
                    .AddSingleton<IChatService, BasicCommandChatService>()
                    .AddSingleton(twitchClient)
                    .BuildServiceProvider();

            Bot bot = new Bot(serviceProvider);
            Console.ReadLine();
        }
    }
}
