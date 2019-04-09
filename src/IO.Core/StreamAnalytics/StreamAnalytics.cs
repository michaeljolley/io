using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

using TwitchLib.Api;
using TwitchLib.Api.Helix.Models.Users;
using TwitchLib.Api.V5.Models.Subscriptions;

using IO.Core.Models;

namespace IO.Core
{
    public class StreamAnalytics
    {
        private readonly TwitchAPI _twitchAPI;

        public StreamAnalytics(TwitchAPI twitchAPI)
        {
            _twitchAPI = twitchAPI;
        }

        public async Task<long> GetFollowerCountAsync()
        {
            var followers = await _twitchAPI.Helix.Users.GetUsersFollowsAsync(toId: Constants.TwitchChannelId);

            if (followers != null)
            {
                return followers.TotalFollows;
            }

            return 0;
        }

        public async Task<int> GetViewerCountAsync()
        {
            var streams = await _twitchAPI.Helix.Streams.GetStreamsAsync(userIds: new List<string>() { Constants.TwitchChannelId });

            if (streams.Streams != null &&
                streams.Streams.Count() > 0)
            {
                var channelStream = streams.Streams[0];

                return channelStream.ViewerCount;
            }

            return 0;
        }

        public async Task<StreamUserModel> GetUserAsync(string userId)
        {
            var users = await _twitchAPI.Helix.Users.GetUsersAsync(new List<string>() { userId }, null, Constants.TwitchChannelAccessToken);
            if (users != null &&
                users.Users.Count() > 0)
            {
                var user = users.Users.First();
                return new StreamUserModel(user.Id, user.DisplayName, user.ProfileImageUrl);
            }
            return null;
        }

        public async Task<StreamUserModel> GetUserByUsernameAsync(string username)
        {
            var users = await _twitchAPI.Helix.Users.GetUsersAsync(null, new List<string>() { username }, Constants.TwitchChannelAccessToken);
            if (users != null &&
                users.Users.Count() > 0)
            {
                var user = users.Users.First();
                return new StreamUserModel(user.Id, user.DisplayName, user.ProfileImageUrl);
            }
            return null;
        }

        public async Task<string> GetLastFollowerAsync()
        {
            var followers = await _twitchAPI.Helix.Users.GetUsersFollowsAsync(toId: Constants.TwitchChannelId, first: 1);
                
            if (followers != null &&
                followers.Follows.Count() > 0)
            {
                string lastFollowerId = followers.Follows.First().FromUserId;
                return lastFollowerId;
            }

            return null;
        }

        public async Task<StreamUserModel> GetLastSubscriberAsync()
        {
            List<Subscription> subscribers = await _twitchAPI.V5.Channels.GetAllSubscribersAsync(Constants.TwitchChannelId);

            var lastSubscriber = subscribers.Last();

            if (lastSubscriber != null)
            {
                return new StreamUserModel(lastSubscriber.Id, lastSubscriber.User.DisplayName, lastSubscriber.User.Logo);
            }

            return null;
        }
    }
}
