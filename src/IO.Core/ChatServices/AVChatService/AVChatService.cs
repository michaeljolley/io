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
    public class AVChatService : BaseChatService, IChatService, IDisposable
    {
        private HubConnection _avHubConnection;

        private Dictionary<string, string> _availableFiles = new Dictionary<string, string>();

        private bool isPaused = false;

        public AVChatService(TwitchClient applicationTwitchClient, IHostingEnvironment hostingEnvironment) :
            base(applicationTwitchClient)
        {
            // Look through the audio/clips directory and register all available clips
            string[] foundAudioClips = System.IO.Directory.GetFiles($"{hostingEnvironment.WebRootPath}/assets/audio/clips"); 
            foreach (string audioClip in foundAudioClips)
            {
                string command = $"!{System.IO.Path.GetFileNameWithoutExtension(audioClip)}";
                _availableFiles.Add(command, System.IO.Path.GetFileName(audioClip));
            }

            ConfigureHubsAsync().Wait();
        }

        // We're not going to publish these commands in our standard !help list
        public List<ChatCommand> AvailableCommands() => new List<ChatCommand>();

        public async Task<string> ProcessMessageAsync(ChatMessage chatMessage)
        {
            string message = chatMessage.Message;

            if (!string.IsNullOrEmpty(message))
            {
                string[] splitMessage = message.Split(null);

                if (_availableFiles.ContainsKey(splitMessage[0].ToLower()) &&
                    !isPaused)
                {
                    string identifiedClipFileName = _availableFiles[splitMessage[0].ToLower()];

                    if (!string.IsNullOrEmpty(identifiedClipFileName))
                    {
                        if (!splitMessage[0].Equals("!sub", StringComparison.InvariantCultureIgnoreCase))
                        {
                            await BroadcastNewAudioClip(identifiedClipFileName);
                        }
                        else if (chatMessage.IsBroadcaster)
                        {
                            await BroadcastNewAudioClip(identifiedClipFileName);
                        }
                    }
                }
                else if (splitMessage[0].Equals("!stop", StringComparison.InvariantCultureIgnoreCase))
                {
                    await BroadcastStopAudioClip();
                    await BroadcastStopVideoClip();
                }
                else if (splitMessage[0].Equals("!av", StringComparison.InvariantCultureIgnoreCase) &&
                        (chatMessage.IsBroadcaster || chatMessage.IsModerator))
                {
                    if (splitMessage.Length > 1)
                    {
                        if (splitMessage[1].Equals("start", StringComparison.InvariantCultureIgnoreCase))
                        {
                            isPaused = false;
                        }

                        if (splitMessage[1].Equals("stop", StringComparison.InvariantCultureIgnoreCase))
                        {
                            isPaused = true;
                        }
                    }
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

        private async Task BroadcastStopAudioClip()
        {
            await _avHubConnection.InvokeAsync("BroadcastStopAudioClips");
        }

        private async Task BroadcastStopVideoClip()
        {
            await _avHubConnection.InvokeAsync("BroadcastStopVideoClips");
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
