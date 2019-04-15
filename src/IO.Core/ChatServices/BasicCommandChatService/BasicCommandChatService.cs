using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

using TwitchLib.Client;
using TwitchLib.Client.Models;

namespace IO.Core.ChatServices
{
    public class BasicCommandChatService : BaseChatService, IChatService
    {
        private readonly List<BasicChatCommand> basicCommands = new List<BasicChatCommand>()
        {
            new BasicChatCommand("!github",
                                 "Mike's GitHub account can be found at https://github.com/michaeljolley",
                                 null,
                                 30),
            new BasicChatCommand("!website",
                                 "Mike's personal website can be found at https://michaeljolley.com",
                                 null,
                                 30),
            new BasicChatCommand("!discord",
                                 "You can join our discord using this link: https://discord.gg/XSG7HJm",
                                 null,
                                 30),
            new BasicChatCommand("!twitter",
                                 "You can find Mike on Twitter at https://twitter.com/michaeljolley",
                                 null,
                                 30),
            new BasicChatCommand("!specs",
                                 "Currently Mike streams from his office PC, which is an Alienware Aurora with a 6-core i7 3.2GHz processor, 48GB of RAM and dual Radeon RX 580 video cards.",
                                 null,
                                 30),
            new BasicChatCommand("!project",
                                 "I have no idea what this guy is working on.  theMichaelJolley, how about an update?",
                                 "!project {new project value}",
                                 30,
                                 false),
            new BasicChatCommand("!candle",
                                 "I dunno. It smells like stinky feet. Maybe we should light a candle theMichaelJolley.",
                                 "!candle {new candle scent}",
                                 30,
                                 false)
        };

        private static Dictionary<string, DateTime> _commandCooldowns = new Dictionary<string, DateTime>();

        public BasicCommandChatService(TwitchClient applicationTwitchClient) :
            base(applicationTwitchClient)
        {}

        public List<ChatCommand> AvailableCommands() => basicCommands.Select(s => (ChatCommand)s).ToList();

        public async Task<string> ProcessMessageAsync(ChatMessage chatMessage)
        {
            string message = chatMessage.Message;

            if (!string.IsNullOrEmpty(message))
            {
                string[] splitMessage = message.Split(null);

                BasicChatCommand command = basicCommands.FirstOrDefault(w => w.Command.ToLower().Equals(splitMessage[0].ToLower()));

                if (command != null)
                {
                    // Identify if there is a command cooldown and check its cooldown before proceeding.
                    KeyValuePair<string, DateTime> commandCooldown = _commandCooldowns.FirstOrDefault(f => f.Key.Equals(command.Command, StringComparison.InvariantCultureIgnoreCase));

                    if (commandCooldown.Key != null &&
                         commandCooldown.Value.AddSeconds(command.ThrottleInSeconds) >= DateTime.Now) 
                        return string.Empty;

                    if (chatMessage.IsModerator || chatMessage.IsBroadcaster)
                    {
                        if (splitMessage.Length > 1 && !command.IsLocked)
                        {
                            command.Value = string.Join(" ", splitMessage.Skip(1).Take(splitMessage.Length - 1));
                        }
                    }

                    string responseMessage = command.Value;

                    if (commandCooldown.Key != null)
                    {
                        _commandCooldowns[command.Command] = DateTime.Now;
                    }
                    else
                    {
                        _commandCooldowns.Add(command.Command, DateTime.Now);
                    }

                    SendMessage(responseMessage);
                    return responseMessage;
                }
            }
            return string.Empty;
        }
    }
}
