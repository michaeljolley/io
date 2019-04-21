using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.SignalR.Client;
using Microsoft.Extensions.Logging;

using TwitchLib.Client;
using TwitchLib.Client.Models;

namespace IO.Core.ChatServices
{
    public class NakedChatService : BaseChatService, IChatService, IDisposable
    {
        private HubConnection _nakedHubConnection;

        public NakedChatService(TwitchClient applicationTwitchClient) :
            base(applicationTwitchClient)
        {
            ConfigureHubsAsync().Wait();
        }

        // We're not going to publish these commands in our standard !help list
        public List<ChatCommand> AvailableCommands() => new List<ChatCommand>()
        {
            new ChatCommand("!naked", "!naked {activate/deactivate}", true)
        };

        public async Task<string> ProcessMessageAsync(ChatMessage chatMessage)
        {
            string message = chatMessage.Message;

            if (!string.IsNullOrEmpty(message))
            {
                string[] splitMessage = message.Split(null);

                if (splitMessage[0].Equals("!naked", StringComparison.InvariantCultureIgnoreCase))
                {
                    if (splitMessage.Length > 0 && 
                        (chatMessage.IsModerator || chatMessage.IsBroadcaster))
                    {
                        switch (splitMessage[1])
                        {
                            case "activate":
                                await BroadcastToggleNakedActive(true);
                                break;
                            case "deactivate":
                                await BroadcastToggleNakedActive(false);
                                break;
                            default:
                                break;
                        }
                    }
                    else
                    {
                        await BroadcastToggleNaked();
                    }
                }
            }
            return string.Empty;
        }

        #region Hub Methods

        private async Task ConfigureHubsAsync()
        {
            _nakedHubConnection = new HubConnectionBuilder()
                .ConfigureLogging(log =>
                {
                    log.AddConsole();
                })
                .WithUrl(Constants.HubOverlayUrl + "/IO-Naked")
                .Build();

            _nakedHubConnection.Closed += async (error) =>
            {
                await Task.Delay(new Random().Next(0, 5) * 1000);
                await ConnectToNakedHub();
            };

            await ConnectToNakedHub();
        }

        private async Task ConnectToNakedHub()
        {
            try
            {
                await _nakedHubConnection.StartAsync();
            }
            catch (Exception ex)
            {
                Console.WriteLine(ex.Message);
            }
        }

        private async Task BroadcastToggleNaked()
        {
            await _nakedHubConnection.InvokeAsync("BroadcastToggleNaked");
        }

        private async Task BroadcastToggleNakedActive(bool isActive)
        {
            await _nakedHubConnection.InvokeAsync("BroadcastToggleNakedActive", isActive);
        }

        #endregion

        public void Dispose()
        {
            if (_nakedHubConnection != null)
            {
                if (_nakedHubConnection.State == HubConnectionState.Connected)
                {
                    _nakedHubConnection.StopAsync().Wait();
                }
                _nakedHubConnection.DisposeAsync().Wait();
            }
        }
    }
}
