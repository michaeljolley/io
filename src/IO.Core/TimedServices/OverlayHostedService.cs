using System;
using System.Threading;
using System.Threading.Tasks;
using IO.Core.Hubs;
using IO.Core.Models;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Hosting;

namespace IO.Core.TimedServices
{
    public class OverlayHostedService : IHostedService
    {
        private IHubContext<IoHub> _overlayHubContext { get; }
        private readonly StreamAnalytics _streamAnalytics;
        private Timer _timer;
        private readonly int _refreshMilliSeconds = 5000;

        private long _followerCount;
        private int _viewerCount;
        private StreamUserModel _lastFollower;

        public OverlayHostedService(StreamAnalytics streamAnalytics, IHubContext<IoHub> overlayHubContext)
        {
            _streamAnalytics = streamAnalytics;
            _overlayHubContext = overlayHubContext;
            _refreshMilliSeconds = Convert.ToInt32(Constants.OverlayRefreshMilliSeconds);
        }

        public Task StartAsync(CancellationToken cancellationToken)
        {
            _timer = new Timer(async (e) => await DoWorkAsync(e, cancellationToken), null, TimeSpan.Zero,
                TimeSpan.FromMilliseconds(_refreshMilliSeconds));

            while (true)
            {
                if (cancellationToken.IsCancellationRequested)
                {
                    break;
                }
            }
            return Task.CompletedTask;
        }

        private async Task DoWorkAsync(object state, CancellationToken cancellationToken)
        {
            if (cancellationToken.IsCancellationRequested)
            {
                _timer?.Change(Timeout.Infinite, Timeout.Infinite);
                return;
            }

            // Check follower count & publish to SignalR hub
            long followerCount = await _streamAnalytics.GetFollowerCountAsync();
            if (followerCount != _followerCount)
            {
                _followerCount = followerCount;
                await _overlayHubContext.Clients.All.SendAsync("ReceiveFollowerCount", _followerCount);
            }

            // Check viewer count & publish to SignalR hub
            int viewerCount = await _streamAnalytics.GetViewerCountAsync();
            if (viewerCount != _viewerCount)
            {
                _viewerCount = viewerCount;
                await _overlayHubContext.Clients.All.SendAsync("ReceiveViewerCount", _viewerCount);
            }

            StreamUserModel lastFollower = await _streamAnalytics.GetLastFollowerAsync();
            if (lastFollower != _lastFollower)
            {
                _lastFollower = lastFollower;
                await _overlayHubContext.Clients.All.SendAsync("ReceiveNewFollower", _lastFollower);
            }
        }

        public Task StopAsync(CancellationToken cancellationToken)
        {
            _timer.Dispose();
            return Task.CompletedTask;
        }
    }
}
