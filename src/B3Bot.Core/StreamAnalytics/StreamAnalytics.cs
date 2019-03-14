using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using TwitchLib.Api;
using TwitchLib.Api.V5.Models.Channels;
using TwitchLib.Api.V5.Models.Streams;

namespace B3Bot.Core
{
    public class StreamAnalytics
    {
        private readonly TwitchAPI _twitchAPI;

        public StreamAnalytics(TwitchAPI twitchAPI)
        {
            _twitchAPI = twitchAPI;
            _twitchAPI.Settings.ClientId = Constants.TwitchAPIClientId;
            _twitchAPI.Settings.AccessToken = Constants.TwitchAPIAccessToken;
        }

        public async Task<int> GetFollowerCountAsync()
        {
            var users = await _twitchAPI.V5.Users.GetUserByNameAsync(Constants.TwitchChannel);
            if (users.Matches.Count() > 0)
            {
                var channelUser = users.Matches[0];

                List<ChannelFollow> followers = await _twitchAPI.V5.Channels.GetAllFollowersAsync(channelUser.Id);
                return followers.Count();
            }

            return 0;
        }

        public async Task<int> GetViewerCountAsync()
        {
            var users = await _twitchAPI.V5.Users.GetUserByNameAsync(Constants.TwitchChannel);
            if (users.Matches.Count() > 0)
            {
                var channelUser = users.Matches[0];

                StreamByUser stream = await _twitchAPI.V5.Streams.GetStreamByUserAsync(channelUser.Id);
                if (stream != null && stream.Stream != null)
                {
                    return stream.Stream.Viewers;
                }
            }

            return 0;
        }
    }
}
