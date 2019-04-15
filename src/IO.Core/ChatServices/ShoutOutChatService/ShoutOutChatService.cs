using System;
using System.Collections.Generic;
using System.Threading.Tasks;

using TwitchLib.Client;
using TwitchLib.Client.Models;

namespace IO.Core.ChatServices
{
    public class ShoutOutChatService : BaseChatService, IChatService
    {
        private const string twitchShoutOutFormat = "Shout out to {0}!  Check out their stream at https://twitch.tv/{0} and give them a follow.";
        private const string twitterShoutOutFormat = "Shout out to {0}!  Follow them at https://twitter.com/{0}";

        private const string invalidFormat = "{0}, the !so command requires the following format: !so username";

        public ShoutOutChatService(TwitchClient applicationTwitchClient) :
            base(applicationTwitchClient)
        {
        }

        public List<ChatCommand> AvailableCommands() => new List<ChatCommand>()
                                                            {
                                                                new ChatCommand("!so", "!so {streamer's username} or !so -t {twitter handle}", true)
                                                            };

        public async Task<string> ProcessMessageAsync(ChatMessage chatMessage)
        {
            // Regardless of whether this method should or can respond
            // to this message, return if not a moderator or the broadcaster
            if (!chatMessage.IsBroadcaster &&
                !chatMessage.IsModerator)
                return string.Empty;

            string message = chatMessage.Message;

            if (!string.IsNullOrEmpty(message))
            {
                string[] splitMessage = message.Split(null);

                if (splitMessage[0].ToLower().Equals("!so"))
                {
                    string responseMessage = string.Empty;

                    if (splitMessage.Length == 2) // Twitch Shout out
                    {
                        string channelName = splitMessage[1].Replace("@", "");
                        responseMessage = string.Format(twitchShoutOutFormat, channelName);
                    }
                    else if (splitMessage.Length == 3 && // Twitter Shout out 
                             splitMessage[1].Equals("-t", StringComparison.InvariantCultureIgnoreCase))
                    {
                        string channelName = splitMessage[2].Replace("@", "");
                        responseMessage = string.Format(twitterShoutOutFormat, channelName);
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
