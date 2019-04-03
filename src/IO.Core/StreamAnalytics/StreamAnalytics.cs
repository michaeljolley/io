using IO.Core.Models;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using TwitchLib.Api;
using TwitchLib.Api.Helix.Models.Users;
using TwitchLib.Api.V5.Models.Channels;
using TwitchLib.Api.V5.Models.Streams;
using TwitchLib.Api.V5.Models.Subscriptions;

namespace IO.Core
{
    public class StreamAnalytics
    {
        private readonly TwitchAPI _twitchAPI;

        private string _lastFollowerId;
        private StreamUserModel _lastFollower;

        public StreamAnalytics(TwitchAPI twitchAPI)
        {
            _twitchAPI = twitchAPI;
            _twitchAPI.Settings.ClientId = Constants.TwitchAPIClientId;
            _twitchAPI.Settings.Secret = Constants.TwitchAPIClientSecret;
            _twitchAPI.Settings.AccessToken = Constants.TwitchChannelAccessToken;
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

        public async Task<User> GetUserAsync(string userId)
        {
            var users = await _twitchAPI.Helix.Users.GetUsersAsync(new List<string>() { userId }, null, Constants.TwitchChannelAccessToken);
            if (users != null &&
                users.Users.Count() > 0)
            {
                var user = users.Users.First();
                return user;
            }
            return null;
        }

        public async Task<StreamUserModel> GetLastFollowerAsync()
        {
            var followers = await _twitchAPI.Helix.Users.GetUsersFollowsAsync(toId: Constants.TwitchChannelId, first: 1);
                
            if (followers != null &&
                followers.Follows.Count() > 0)
            {
                var lastFollower = followers.Follows.First();

                if (_lastFollowerId != lastFollower.FromUserId)
                {
                    _lastFollowerId = lastFollower.FromUserId;

                    User userObj = await GetUserAsync(_lastFollowerId);

                    _lastFollower = new StreamUserModel(userObj.DisplayName, userObj.ProfileImageUrl);
                }

                return _lastFollower;
            }

            return null;
        }

        public async Task<StreamUserModel> GetLastSubscriberAsync()
        {
            List<Subscription> subscribers = await _twitchAPI.V5.Channels.GetAllSubscribersAsync(Constants.TwitchChannelId);

            var lastSubscriber = subscribers.Last();

            if (lastSubscriber != null)
            {
                return new StreamUserModel(lastSubscriber.User.DisplayName, lastSubscriber.User.Logo);
            }

            return null;
        }
    }
}
