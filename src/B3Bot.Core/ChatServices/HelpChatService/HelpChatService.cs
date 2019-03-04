using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.Extensions.DependencyInjection;

using TwitchLib.Client;
using TwitchLib.Client.Models;

namespace B3Bot.Core.ChatServices
{
    public class HelpChatService : IChatService
    {
        private readonly TwitchClient twitchClient;
        private readonly IServiceProvider serviceProvider;

        private static List<ChatCommand> availableCommands = new List<ChatCommand>();

        public HelpChatService(TwitchClient applicationTwitchClient, IServiceProvider applicationServiceProvider)
        {
            twitchClient = applicationTwitchClient;
            serviceProvider = applicationServiceProvider;
        }

        public List<ChatCommand> AvailableCommands()
        {
            return new List<ChatCommand>()
            {
                new ChatCommand("!help", null, true)
            };
        }

        public async Task<bool> ProcessMessageAsync(ChatMessage chatMessage)
        {
            string message = chatMessage.Message;

            if (!string.IsNullOrEmpty(message))
            {
                string[] splitMessage = message.Split(null);

                if (splitMessage[0].ToLower().Equals("!help"))
                {
                    if (availableCommands.Count == 0)
                    {
                        IEnumerable<IChatService> chatServices = serviceProvider.GetServices<IChatService>();

                        List<ChatCommand> allCommands = new List<ChatCommand>();

                        foreach (IChatService chatService in chatServices)
                        {
                            allCommands.AddRange(chatService.AvailableCommands());
                        }

                        availableCommands = allCommands.OrderBy(o => o.Command).ToList();
                    }

                    if (availableCommands.Count > 0)
                    {
                        string response = "I can respond to the following commands: ";
                        string commands = "";

                        foreach (ChatCommand chatCommand in availableCommands)
                        {
                            commands += string.IsNullOrEmpty(commands) ? "" : ", ";
                            commands += chatCommand.Command;
                        }
                        response += commands;
                        twitchClient.SendMessage(Constants.TwitchChannel, response);
                    }
                    else
                    {
                        twitchClient.SendMessage(Constants.TwitchChannel, "Uh oh.  I don't seem to know any commands at the moment.");
                    }

                    return true;
                }
            }
            return false;
        }
    }
}
