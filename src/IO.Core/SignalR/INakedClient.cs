using System;
using System.Threading.Tasks;

namespace IO.Core.SignalR
{
    public interface INakedClient
    {
        Task ReceiveToggleNaked();
        Task ReceiveToggleActive(bool isActive);
    }
}