using System;
using System.Threading.Tasks;
using Microsoft.AspNetCore.SignalR;

using IO.Core.Models;

namespace IO.Core.SignalR
{
    /// <summary>
    /// Used as the hub to send messages regarding various static values regarding the stream
    /// </summary>
    public class OverlayHub : Hub<IOverlayHubClient>
    {
        /// <summary>
        /// Broadcasts the provided follower count to listening clients
        /// </summary>
        /// <param name="followerCount">Current follower count of the stream</param>
        public async Task BroadcastNewFollowerCount(int followerCount)
        {
            await Clients.All.ReceiveFollowerCount(followerCount);
        }

        /// <summary>
        /// Broadcasts the provided viewer count to listening clients
        /// </summary>
        /// <param name="viewerCount">Current viewer count of the stream</param>
        public async Task BroadcastNewViewerCount(int viewerCount)
        {
            await Clients.All.ReceiveViewerCount(viewerCount);
        }

        /// <summary>
        /// Broadcasts the last follower to listening clients
        /// </summary>
        /// <param name="lastFollower">Last follower of the stream</param>
        public async Task BroadcastLastFollower(StreamUserModel lastFollower)
        {
            await Clients.All.ReceiveLastFollower(lastFollower);
        }

        /// <summary>
        /// Broadcasts the last subscriber to listening clients
        /// </summary>
        /// <param name="lastSubscriber">Last subscriber to the stream</param>
        public async Task BroadcastLastSubscriber(StreamUserModel lastSubscriber)
        {
            await Clients.All.ReceiveLastSubscriber(lastSubscriber);
        }
    }
}
