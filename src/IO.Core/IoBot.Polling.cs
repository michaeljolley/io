using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

using IO.Core.Models;

namespace IO.Core
{
    public partial class IoBot
    {
        private void ConfigurePolling()
        {
            // Start the timer to run at the configured interval and 
            // poll StreamAnalytics to send changes to the SignalR hub
            _timer = new Timer(async (e) => await PollAsync(e, _cancellationToken), null, TimeSpan.Zero,
                TimeSpan.FromMilliseconds(_refreshMilliSeconds));
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
    }
}
