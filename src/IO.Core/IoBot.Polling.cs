using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

using IO.Core.Models;

namespace IO.Core
{
    public partial class IoBot
    {
        private Timer _timer;

        private Dictionary<string, Timer> _chatReminderTimers = new Dictionary<string, Timer>();

        private void ConfigurePolling()
        {
            // Start the timer to run at the configured interval and 
            // poll StreamAnalytics to send changes to the SignalR hub
            _timer = new Timer(async (e) => await PollAsync(e, _cancellationToken), null, TimeSpan.Zero,
                TimeSpan.FromMilliseconds(_refreshMilliSeconds));

            // Setup reminders to fire and reminder chatters of various topics
            _chatReminderTimers.Add("follow", new Timer(async (e) => await FollowChatReminderAsync(e, _cancellationToken), null, TimeSpan.Zero,
                TimeSpan.FromMinutes(9)));

            _chatReminderTimers.Add("prime", new Timer(async (e) => await PrimeChatReminderAsync(e, _cancellationToken), null, TimeSpan.Zero,
                TimeSpan.FromMinutes(19)));

            _chatReminderTimers.Add("discord", new Timer(async (e) => await DiscordChatReminderAsync(e, _cancellationToken), null, TimeSpan.Zero,
                TimeSpan.FromMinutes(16)));

            _chatReminderTimers.Add("question", new Timer(async (e) => await QuestionChatReminderAsync(e, _cancellationToken), null, TimeSpan.Zero,
                TimeSpan.FromMinutes(7)));
        }

        private async Task PollAsync(object state, CancellationToken cancellationToken)
        {
            if (cancellationToken.IsCancellationRequested)
            {
                _timer?.Change(Timeout.Infinite, Timeout.Infinite);
                return;
            }

            // Check follower count & publish to SignalR hub
            long followerCount = await _streamAnalytics.GetFollowerCountAsync();
            await BroadcastNewFollowerCount(followerCount);

            // Check viewer count & publish to SignalR hub
            int viewerCount = await _streamAnalytics.GetViewerCountAsync();
            await BroadcastNewViewerCount(viewerCount);

            // Check for last follower and publish to SignalR hub
            string lastFollowerId = await _streamAnalytics.GetLastFollowerAsync();
            StreamUserModel _lastFollower = _knownUsers.FirstOrDefault(f => f.Id.Equals(lastFollowerId, StringComparison.InvariantCultureIgnoreCase));
            if (_lastFollower == null)
            {
                _lastFollower = await _streamAnalytics.GetUserAsync(lastFollowerId);
                AddKnownUser(_lastFollower);
            }
            await BroadcastLastFollower(_lastFollower);

            // Check for last subscriber and publish to SignalR hub
            StreamUserModel lastSubscriber = await _streamAnalytics.GetLastSubscriberAsync();
            if (!_knownUsers.Any(f => f.Id.Equals(lastSubscriber.Id, StringComparison.InvariantCultureIgnoreCase)))
            {
                AddKnownUser(lastSubscriber);
            }
            await BroadcastLastSubscriber(lastSubscriber);
        }

        private async Task FollowChatReminderAsync(object state, CancellationToken cancellationToken)
        {
            if (cancellationToken.IsCancellationRequested)
            {
                _chatReminderTimers["follow"]?.Change(Timeout.Infinite, Timeout.Infinite);
                return;
            }

            string message = "Enjoying the stream?  Press the follow button above to be notified when we're live.";
            await SendBotMessage(message);
        }

        private async Task PrimeChatReminderAsync(object state, CancellationToken cancellationToken)
        {
            if (cancellationToken.IsCancellationRequested)
            {
                _chatReminderTimers["prime"]?.Change(Timeout.Infinite, Timeout.Infinite);
                return;
            }

            string message = "Have Amazon Prime?  You can use Twitch Prime to subscribe for free!";
            await SendBotMessage(message);
        }

        private async Task DiscordChatReminderAsync(object state, CancellationToken cancellationToken)
        {
            if (cancellationToken.IsCancellationRequested)
            {
                _chatReminderTimers["discord"]?.Change(Timeout.Infinite, Timeout.Infinite);
                return;
            }
            
            string message = "Stay in touch when we're not live. Join our Discord channel at https://discord.gg/XSG7HJm";
            await SendBotMessage(message);
        }

        private async Task QuestionChatReminderAsync(object state, CancellationToken cancellationToken)
        {
            if (cancellationToken.IsCancellationRequested)
            {
                _chatReminderTimers["question"]?.Change(Timeout.Infinite, Timeout.Infinite);
                return;
            }
            string message = "Thanks for stopping by today!  Have a question?  Feel free to ask.  We love to help others succeed!";
            await SendBotMessage(message);
        }

        private async Task SendBotMessage(string message)
        {
            if (!_twitchClient.IsConnected ||
                _twitchClient.JoinedChannels.Count == 0)
                return;
         
            _twitchClient.SendMessage(Constants.TwitchChannel, message);
            ChatHubMessage chatHubMessage = ChatHubMessage.FromBot(message);
            await BroadcastChatMessage(chatHubMessage);
        }
    }
}
