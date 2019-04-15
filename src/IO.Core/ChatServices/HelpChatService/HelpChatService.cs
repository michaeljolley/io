using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.Extensions.DependencyInjection;

using TwitchLib.Client;
using TwitchLib.Client.Models;

namespace IO.Core.ChatServices
{
    public class HelpChatService : BaseChatService, IChatService
    {
        private readonly IServiceProvider serviceProvider;
        private static List<ChatCommand> availableCommands = new List<ChatCommand>();

        private const int _throttleInSeconds = 30;
        private static DateTime? _commandLastRun;

        public HelpChatService(TwitchClient applicationTwitchClient, IServiceProvider applicationServiceProvider) :
            base(applicationTwitchClient)
        {
            serviceProvider = applicationServiceProvider;
        }

        public List<ChatCommand> AvailableCommands() => new List<ChatCommand>()
                                                                {
                                                                    new ChatCommand("!commands",
                                                                                    null,
                                                                                    true),
                                                                };

        public async Task<string> ProcessMessageAsync(ChatMessage chatMessage)
        {
            // Regardless of whether this method should or can respond
            // to this message, return if throttled. (Unless it's initiated by
            // the bot or broadcaster)
            if (!chatMessage.IsBroadcaster &&
                !chatMessage.Username.Equals(Constants.TwitchChatBotUsername, StringComparison.InvariantCultureIgnoreCase) &&
                _commandLastRun.HasValue && 
                _commandLastRun.Value.AddSeconds(_throttleInSeconds) >= DateTime.Now)
                return string.Empty;

            string message = chatMessage.Message;

            if (!string.IsNullOrEmpty(message))
            {
                string[] splitMessage = message.Split(null);

                if (splitMessage[0].ToLower().Equals("!help") || splitMessage[0].ToLower().Equals("!commands"))
                {
                    string responseMessage = string.Empty;

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
                        responseMessage = "I can respond to the following commands: ";
                        string commands = "";

                        foreach (ChatCommand chatCommand in availableCommands)
                        {
                            commands += string.IsNullOrEmpty(commands) ? "" : ", ";
                            commands += chatCommand.Command;
                        }
                        responseMessage += commands;
                    }
                    else
                    {
                        responseMessage = "Uh oh.  I don't seem to know any commands at the moment.";
                    }

                    _commandLastRun = DateTime.Now;
                    SendMessage(responseMessage);
                    return responseMessage;
                }
            }
            return string.Empty;
        }
    }
}
