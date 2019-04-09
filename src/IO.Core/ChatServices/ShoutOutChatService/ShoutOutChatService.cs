using System;
using System.Collections.Generic;
using System.Threading.Tasks;

using TwitchLib.Client;
using TwitchLib.Client.Models;

namespace IO.Core.ChatServices
{
    public class ShoutOutChatService : BaseChatService, IChatService
    {
        private const string shoutoutFormat = "Shout out to {0}!  Check out their stream at https://twitch.tv/{0} and give them a follow.";
        private const string invalidFormat = "{0}, the !so command requires the following format: !so username";

        public ShoutOutChatService(TwitchClient applicationTwitchClient) :
            base(applicationTwitchClient)
        {
        }

        public List<ChatCommand> AvailableCommands() => new List<ChatCommand>()
                                                            {
                                                                new ChatCommand("!so", "!so {streamer's username}", true)
                                                            };

        public async Task<string> ProcessMessageAsync(ChatMessage chatMessage)
        {
            string message = chatMessage.Message;

            if (!string.IsNullOrEmpty(message))
            {
                string[] splitMessage = message.Split(null);

                if (splitMessage[0].ToLower().Equals("!so"))
                {
                    string responseMessage = string.Empty;
                    if (splitMessage.Length == 2)
                    {
                        string channelName = splitMessage[1].Replace("@", "");
                        responseMessage = string.Format(shoutoutFormat, channelName);
                    }
                    else
                    {
                        responseMessage = string.Format(invalidFormat, chatMessage.DisplayName);
                        SendMessage(responseMessage);
                    }
                    SendMessage(responseMessage);
                    return responseMessage;
                }
            }
            return string.Empty;
        }
    }
}
