using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.Extensions.DependencyInjection;

using TwitchLib.Client.Events;
using TwitchLib.Client.Models;
using TwitchLib.Communication.Events;

using IO.Core.ChatServices;
using IO.Core.Models;

namespace IO.Core
{
    public partial class IoBot
    {
        private void ConfigureChat()
        {
            ConnectionCredentials credentials = new ConnectionCredentials(Constants.TwitchChatBotUsername, Constants.TwitchChatBotAccessToken);
            _twitchClient.Initialize(credentials, Constants.TwitchChannel);

            #region Client Registrations

            _twitchClient.OnConnected += Client_OnConnected;
            _twitchClient.OnDisconnected += Client_OnDisconnected;
            _twitchClient.OnUserJoined += async (sender, e) =>
                                    {
                                        await Client_OnUserJoined(sender, e);
                                    };
            _twitchClient.OnWhisperReceived += Client_OnWhisperReceived;
            _twitchClient.OnMessageReceived += async (sender, e) =>
                                    {
                                        await Client_OnMessageReceivedAsync(sender, e);
                                    };
            _twitchClient.OnRaidNotification += async (sender, e) =>
                                    {
                                        await Client_OnRaidNotification(sender, e);
                                    };

            #endregion

            _twitchClient.Connect();
        }

        private void Client_OnConnected(object sender, OnConnectedArgs e)
        {
            Console.WriteLine($"Connected to {e.AutoJoinChannel}");
        }

        private void Client_OnDisconnected(object sender, OnDisconnectedEventArgs e)
        {
            Console.WriteLine($"Disconnected from chat");

            // if not shutting down on purpose, reconnect
            if (!isShuttingDown)
            {
                _twitchClient.Connect();
            }
        }

        private async Task Client_OnUserJoined(object sender, OnUserJoinedArgs e)
        {
            if (!_knownUsers.Any(c => c.DisplayName.Equals(e.Username, StringComparison.InvariantCultureIgnoreCase)))
            {
                StreamUserModel newChatter = await _streamAnalytics.GetUserByUsernameAsync(e.Username);
                AddKnownUser(newChatter);
            }
        }

        private async Task Client_OnMessageReceivedAsync(object sender, OnMessageReceivedArgs e)
        {
            IEnumerable<IChatService> chatServices = _serviceProvider.GetServices<IChatService>();
            string botResponse = string.Empty;

            foreach (IChatService chatService in chatServices)
            {
                botResponse = await chatService.ProcessMessageAsync(e.ChatMessage);

                if (!string.IsNullOrEmpty(botResponse))
                {
                    break;
                }
            }

            StreamUserModel chatUser = _knownUsers.FirstOrDefault(f => f.Id.Equals(e.ChatMessage.UserId, StringComparison.CurrentCultureIgnoreCase));
            if (chatUser == null)
            {
                chatUser = await _streamAnalytics.GetUserAsync(e.ChatMessage.UserId);
                AddKnownUser(chatUser);
            }

            await BroadcastChatMessage(ChatHubMessage.FromChatMessage(e.ChatMessage, chatUser));

            if (!string.IsNullOrEmpty(botResponse))
            {
                ChatHubMessage chatHubMessage = ChatHubMessage.FromBot(botResponse);
                await BroadcastChatMessage(chatHubMessage);
            }

            EmoteSet emoteSet = e.ChatMessage.EmoteSet;
            if (emoteSet != null && emoteSet.Emotes.Count > 0)
            {
                List<EmoteSet.Emote> emotes = emoteSet.Emotes;

                foreach (EmoteSet.Emote emote in emotes)
                {
                    await BroadcastEmote(emote.ImageUrl);
                    await Task.Delay(new Random().Next(500, 1200));
                }
            }
        }

        private void Client_OnWhisperReceived(object sender, OnWhisperReceivedArgs e)
        {
            _twitchClient.SendWhisper(e.WhisperMessage.Username, $"Hey {e.WhisperMessage.Username}! I'm a bot.  I'm not great at whispering.");
        }

        private async Task Client_OnRaidNotification(object sender, OnRaidNotificationArgs e)
        {
            await BroadcastNewRaid(e);
        }
    }
}
