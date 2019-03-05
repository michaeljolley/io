using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using TwitchLib.Client;
using TwitchLib.Client.Models;

namespace B3Bot.Core.ChatServices
{
    public class BasicCommandChatService : IChatService
    {
        private readonly TwitchClient twitchClient;
        private List<BasicChatCommand> basicCommands = new List<BasicChatCommand>()
        {
            new BasicChatCommand("!github", "Mike's GitHub account can be found at https://github.com/michaeljolley", null, true),
            new BasicChatCommand("!website", "Mike's personal website can be found at https://michaeljolley.com", null, true),
            new BasicChatCommand("!specs", "Currently Mike streams from his office PC, which is an Alienware Aurora with a 6-core i7 3.2GHz processor, 48GB of RAM and dual Radeon RX 580 video cards.", null, true),
            new BasicChatCommand("!twitter", "You can find Mike on Twitter at https://twitter.com/michaeljolley", null, true),

            new BasicChatCommand("!project", "I have no idea what this guy is working on.  theMichaelJolley, how about an update?", "!project {new project value}", false)
        };

        public BasicCommandChatService(TwitchClient applicationTwitchClient)
        {
            twitchClient = applicationTwitchClient;
        }

        public List<ChatCommand> AvailableCommands()
        {
            return basicCommands.Select(s => (ChatCommand)s).ToList();
        }

        public async Task<bool> ProcessMessageAsync(ChatMessage chatMessage)
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
                            return true;
                        }
                    }

                    twitchClient.SendMessage(Constants.TwitchChannel, command.Value);
                    return true;
                }
            }
            return false;
        }
    }
}
