using System.Collections.Generic;
using System.Threading.Tasks;
using TwitchLib.Client;
using TwitchLib.Client.Models;

namespace B3Bot.Core.ChatServices
{
    public class ShoutOutChatService : IChatService
    {
        private readonly TwitchClient twitchClient;

        private string shoutoutFormat = "Shout out to {0}!  Check out their stream at https://twitch.tv/{0} and give them a follow.";
        private string invalidFormat = "{0}, the !so command requires the following format: !so username";

        public ShoutOutChatService(TwitchClient applicationTwitchClient)
        {
            twitchClient = applicationTwitchClient;
        }

        public List<ChatCommand> AvailableCommands()
        {
            return new List<ChatCommand>()
            {
                new ChatCommand("!so", "!so {streamer's username}", true)
            };
        }

        public async Task<bool> ProcessMessageAsync(ChatMessage chatMessage)
        {
            string message = chatMessage.Message;

            if (!string.IsNullOrEmpty(message))
            {
                string[] splitMessage = message.Split(null);

                if (splitMessage[0].ToLower().Equals("!so"))
                {
                    if (splitMessage.Length == 2)
                    {
                        twitchClient.SendMessage(Constants.TwitchChannel, string.Format(shoutoutFormat, splitMessage[1]));
                    }
                    else
                    {
                        twitchClient.SendMessage(Constants.TwitchChannel, string.Format(invalidFormat, chatMessage.DisplayName));
                    }
                    return true;
                }
            }
            return false;
        }
    }
}
