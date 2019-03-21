using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using TwitchLib.Api;
using TwitchLib.Api.Services;
using TwitchLib.Api.V5.Models.Users;
using TwitchLib.Client;
using TwitchLib.Client.Models;

namespace B3Bot.Core.ChatServices
{
    public class UptimeChatService : IChatService
    {
        private readonly TwitchClient twitchClient;
        private readonly TwitchAPI twitchAPI;

        private const string upTimeResponse = "{0}, the stream has been up for {1}. {2}";
        private const string offlineResponse = "{0}, the stream is currently offline.  Hit follow to be notified when we go live!";

        public UptimeChatService(TwitchClient applicationTwitchClient, TwitchAPI applicationTwitchAPI)
        {
            twitchClient = applicationTwitchClient;
            twitchAPI = applicationTwitchAPI;
        }

        public List<ChatCommand> AvailableCommands()
        {
            return new List<ChatCommand>()
            {
                new ChatCommand("!uptime", null, true)
            };
        }

        public async Task<bool> ProcessMessageAsync(ChatMessage chatMessage)
        {
            string message = chatMessage.Message;

            if (!string.IsNullOrEmpty(message))
            {
                string[] splitMessage = message.Split(null);

                if (splitMessage[0].ToLower().Equals("!uptime"))
                {
                    try
                    {
                        if (await twitchAPI.V5.Streams.BroadcasterOnlineAsync(Constants.TwitchChannelId))
                        { 
                            TimeSpan? uptime = twitchAPI.V5.Streams.GetUptimeAsync(Constants.TwitchChannelId).Result;
                            if (uptime.HasValue)
                            {
                                string upTimeValueMessage = "";
                                if (uptime.Value.Hours > 0)
                                {
                                    upTimeValueMessage = $"{uptime.Value.Hours} hours and ";
                                }
                                upTimeValueMessage += $"{uptime.Value.Minutes} minutes";

                                string followerMessage = "";
                                if (chatMessage.UserId != Constants.TwitchChannelId)
                                {
                                    UserFollow userFollow = await twitchAPI.V5.Users.CheckUserFollowsByChannelAsync(chatMessage.UserId, Constants.TwitchChannelId);

                                    if (userFollow == null)
                                    {
                                        followerMessage = "Give us a follow so you won't miss a minute next time.";
                                    }
                                }

                                string response = string.Format(upTimeResponse, chatMessage.DisplayName, upTimeValueMessage, followerMessage);
                            
                                twitchClient.SendMessage(Constants.TwitchChannel, response);
                            }
                        }
                        else
                        {
                            twitchClient.SendMessage(Constants.TwitchChannel, string.Format(offlineResponse, chatMessage.DisplayName));
                        }
                    }
                    catch (Exception ex)
                    {

                    }

                    return true;
                }
            }
            return false;
        }
    }
}
