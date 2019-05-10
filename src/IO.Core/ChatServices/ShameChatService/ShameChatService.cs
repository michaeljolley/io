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
    public class ShameChatService : BaseChatService, IChatService, IDisposable
    {
        private HubConnection _avHubConnection;

        public ShameChatService(TwitchClient applicationTwitchClient, IHostingEnvironment hostingEnvironment) :
            base(applicationTwitchClient)
        {
            ConfigureHubsAsync().Wait();
        }

        // We're not going to publish these commands in our standard !help list
        public List<ChatCommand> AvailableCommands() => new List<ChatCommand>();

        public async Task<string> ProcessMessageAsync(ChatMessage chatMessage)
        {
            string message = chatMessage.Message;

            if (!string.IsNullOrEmpty(message) && !IsAVPaused)
            {
                message = message.Trim().ToLower();

                switch (message)
                {
                    case "!theme hotdogstand":
                        string response = $"HotDog Stand!?! Shame on you @{chatMessage.DisplayName}!";
                        SendMessage(response);
                        await BroadcastNewAudioClip("shame.mp3");
                        return $"HotDog Stand!?! Shame on you @{chatMessage.DisplayName}! <img class='emote' src='https://static-cdn.jtvnw.net/emoticons/v1/300179561/1.0'/>";
                    default:
                        break;
                }
            }
            return string.Empty;
        }

        #region Hub Methods

        private async Task ConfigureHubsAsync()
        {
            _avHubConnection = new HubConnectionBuilder()
                .ConfigureLogging(log =>
                {
                    log.AddConsole();
                })
                .WithUrl(Constants.HubOverlayUrl + "/IO-AV")
                .Build();

            _avHubConnection.Closed += async (error) =>
            {
                await Task.Delay(new Random().Next(0, 5) * 1000);
                await ConnectToAVHub();
            };

            await ConnectToAVHub();
        }

        private async Task ConnectToAVHub()
        {
            try
            {
                await _avHubConnection.StartAsync();
            }
            catch (Exception ex)
            {
                Console.WriteLine(ex.Message);
            }
        }

        private async Task BroadcastNewAudioClip(string filename)
        {
            await _avHubConnection.InvokeAsync("BroadcastNewAudioClip", filename);
        }

        private async Task BroadcastNewVideoClip(string filename)
        {
            await _avHubConnection.InvokeAsync("BroadcastNewVideoClip", filename);
        }

        #endregion

        public void Dispose()
        {
            if (_avHubConnection != null)
            {
                if (_avHubConnection.State == HubConnectionState.Connected)
                {
                    _avHubConnection.StopAsync().Wait();
                }
                _avHubConnection.DisposeAsync().Wait();
            }
        }
    }
}
