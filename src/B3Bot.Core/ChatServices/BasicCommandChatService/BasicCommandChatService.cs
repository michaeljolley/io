using System.Collections.Generic;
using System.Linq;

using TwitchLib.Client;
using TwitchLib.Client.Models;

namespace B3Bot.Core.ChatServices
{
    public class BasicCommandChatService : IChatService
    {
        private readonly TwitchClient twitchClient;
        private List<BasicCommand> basicCommands = new List<BasicCommand>()
        {
            new BasicCommand("!github", "Mike's GitHub account can be found at https://github.com/michaeljolley", true),
            new BasicCommand("!website", "Mike's personal website can be found at https://michaeljolley.com", true),
            new BasicCommand("!specs", "Currently Mike streams from his office PC, which is an Alienware Aurora with a 6-core i7 3.2GHz processor, 48GB of RAM and dual Radeon RX 580 video cards.", true),
            new BasicCommand("!twitter", "You can find Mike on Twitter at https://twitter.com/michaeljolley", true),

            new BasicCommand("!project", "I have no idea what this guy is working on.  theMichaelJolley, how about an update?")
        };

        public BasicCommandChatService(TwitchClient applicationTwitchClient)
        {
            twitchClient = applicationTwitchClient;
        }

        public void ProcessMessage(ChatMessage chatMessage)
        {
            string message = chatMessage.Message;

            if (!string.IsNullOrEmpty(message))
            {
                string[] splitMessage = message.Split(null);

                var command = basicCommands.FirstOrDefault(w => w.Command.ToLower().Equals(splitMessage[0].ToLower()));

                if (command != null)
                {
                    if (chatMessage.IsModerator || chatMessage.IsBroadcaster)
                    {
                        if (splitMessage.Length > 1 && !command.IsLocked)
                        {
                            command.Value = string.Join(" ", splitMessage.Skip(1).Take(splitMessage.Length - 1));
                        }
                    }

                    twitchClient.SendMessage(Constants.TwitchChannel, command.Value);
                }
            }
        }
    }
}
