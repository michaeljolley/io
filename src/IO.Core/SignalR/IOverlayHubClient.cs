using System;
using System.Threading.Tasks;

using IO.Core.Models;

namespace IO.Core.SignalR
{
    public interface IOverlayHubClient
    {
        Task ReceiveFollowerCount(int followerCount);

        Task ReceiveViewerCount(int viewerCount);

        Task ReceiveLastFollower(StreamUserModel lastFollower);

        Task ReceiveLastSubscriber(StreamUserModel lastSubscriber);
    }
}
