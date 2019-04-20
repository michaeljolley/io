using System;
using System.Threading.Tasks;
using Microsoft.AspNetCore.SignalR.Client;
using Microsoft.Extensions.Logging;

using TwitchLib.Client.Events;
using TwitchLib.PubSub.Events;
using TwitchLib.PubSub.Models.Responses.Messages;

using IO.Core.Models;

namespace IO.Core
{
    public partial class IoBot
    {
        private HubConnection _alertHubConnection;
        private HubConnection _avHubConnection;
        private HubConnection _chatHubConnection;
        private HubConnection _nakedHubConnection;
        private HubConnection _overlayHubConnection;

        private async Task ConfigureHubsAsync()
        {
            _alertHubConnection = new HubConnectionBuilder()
                .ConfigureLogging(log =>
                {
                    log.AddConsole();
                })
                .WithUrl(Constants.HubOverlayUrl + "/IO-Alert")
                .Build();

            _avHubConnection = new HubConnectionBuilder()
                .ConfigureLogging(log =>
                {
                    log.AddConsole();
                })
                .WithUrl(Constants.HubOverlayUrl + "/IO-AV")
                .Build();

            _chatHubConnection = new HubConnectionBuilder()
                .ConfigureLogging(log =>
                {
                    log.AddConsole();
                })
                .WithUrl(Constants.HubOverlayUrl + "/IO-Chat")
                .Build();

            _nakedHubConnection = new HubConnectionBuilder()
                .ConfigureLogging(log =>
                {
                    log.AddConsole();
                })
                .WithUrl(Constants.HubOverlayUrl + "/IO-Naked")
                .Build();

            _overlayHubConnection = new HubConnectionBuilder()
                .ConfigureLogging(log =>
                {
                    log.AddConsole();
                })
                .WithUrl(Constants.HubOverlayUrl + "/IO-Overlay")
                .Build();

            _alertHubConnection.Closed += async (error) =>
            {
                await Task.Delay(new Random().Next(0, 5) * 1000);
                await ConnectToAlertHub();
            };
            _avHubConnection.Closed += async (error) =>
            {
                await Task.Delay(new Random().Next(0, 5) * 1000);
                await ConnectToAVHub();
            };
            _chatHubConnection.Closed += async (error) =>
            {
                await Task.Delay(new Random().Next(0, 5) * 1000);
                await ConnectToAlertHub();
            };
            _nakedHubConnection.Closed += async (error) =>
            {
                await Task.Delay(new Random().Next(0, 5) * 1000);
                await ConnectToNakedHub();
            };
            _overlayHubConnection.Closed += async (error) =>
            {
                await Task.Delay(new Random().Next(0, 5) * 1000);
                await ConnectToOverlayHub();
            };

            await ConnectToAlertHub();
            await ConnectToAVHub();
            await ConnectToChatHub();
            await ConnectToNakedHub();
            await ConnectToOverlayHub();
        }

        private async Task ConnectToAlertHub()
        {
            try
            {
                await _alertHubConnection.StartAsync();
            }
            catch (Exception ex)
            {
                Console.WriteLine(ex.Message);
            }
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

        private async Task ConnectToChatHub()
        {
            try
            {
                await _chatHubConnection.StartAsync();
            }
            catch (Exception ex)
            {
                Console.WriteLine(ex.Message);
            }
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

        private async Task ConnectToOverlayHub()
        {
            try
            {
                await _overlayHubConnection.StartAsync();
            }
            catch (Exception ex)
            {
                Console.WriteLine(ex.Message);
            }
        }

        /// <summary>
        /// Broadcasts the provided chat message to clients of the hub
        /// </summary>
        /// <param name="chatHubMessage">Message received from Twitch IRC chat</param>
        private async Task BroadcastChatMessage(ChatHubMessage chatHubMessage)
        {
            await _chatHubConnection.InvokeAsync("BroadcastChatMessage", chatHubMessage);
        }

        /// <summary>
        /// Broadcasts the provided url of the emote received
        /// </summary>
        /// <param name="emoteUrl">Url of the emote in a Twitch IRC message</param>
        private async Task BroadcastEmote(string emoteUrl)
        {
            await _chatHubConnection.InvokeAsync("BroadcastEmote", emoteUrl);
        }

        /// <summary>
        /// Broadcasts the provided follower count to listening clients
        /// </summary>
        /// <param name="followerCount">Current follower count of the stream</param>
        private async Task BroadcastNewFollowerCount(long followerCount)
        {
            await _overlayHubConnection.InvokeAsync("BroadcastNewFollowerCount", followerCount);
        }

        /// <summary>
        /// Broadcasts the provided viewer count to listening clients
        /// </summary>
        /// <param name="viewerCount">Current viewer count of the stream</param>
        private async Task BroadcastNewViewerCount(int viewerCount)
        {
            await _overlayHubConnection.InvokeAsync("BroadcastNewViewerCount", viewerCount);
        }

        /// <summary>
        /// Broadcasts the last follower to listening clients
        /// </summary>
        /// <param name="lastFollower">Last follower of the stream</param>
        private async Task BroadcastLastFollower(StreamUserModel lastFollower)
        {
            await _overlayHubConnection.InvokeAsync("BroadcastLastFollower", lastFollower);
        }

        /// <summary>
        /// Broadcasts the last subscriber to listening clients
        /// </summary>
        /// <param name="lastSubscriber">Last subscriber to the stream</param>
        private async Task BroadcastLastSubscriber(StreamUserModel lastSubscriber)
        {
            await _overlayHubConnection.InvokeAsync("BroadcastLastSubscriber", lastSubscriber);
        }

        /// <summary>
        /// Broadcasts the last subscriber to listening clients
        /// </summary>
        /// <param name="newChannelSubscription">Last subscriber to the stream</param>
        private async Task BroadcastNewSubscriber(ChannelSubscription newChannelSubscription)
        {
            await _alertHubConnection.InvokeAsync("BroadcastNewSubscriber", newChannelSubscription);
        }

        public async Task BroadcastNewFollower(StreamUserModel newFollower)
        {
            await _alertHubConnection.InvokeAsync("BroadcastNewFollower", newFollower);
        }

        public async Task BroadcastNewCheer(OnBitsReceivedArgs onBitsReceivedArgs)
        {
            await _alertHubConnection.InvokeAsync("BroadcastNewCheer", onBitsReceivedArgs);
        }

        public async Task BroadcastNewRaid(OnRaidNotificationArgs onRaidNotificationArgs)
        {
            await _alertHubConnection.InvokeAsync("BroadcastNewRaid", onRaidNotificationArgs);
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

        private async Task BroadcastToggleNaked()
        {
            await _nakedHubConnection.InvokeAsync("BroadcastToggleNaked");
        }

        private async Task BroadcastToggleNakedActive(bool isActive)
        {
            await _nakedHubConnection.InvokeAsync("BroadcastToggleNakedActive", isActive);
        }

    }
}
