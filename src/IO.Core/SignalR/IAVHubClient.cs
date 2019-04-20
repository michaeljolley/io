using System;
using System.Threading.Tasks;

namespace IO.Core.SignalR
{
    public interface IAVHubClient
    {
        Task ReceiveNewAudioClip(string filename);
        Task ReceiveNewVideoClip(string filename);

        Task ReceiveStopAudioClips();
        Task ReceiveStopVideoClips();
    }
}