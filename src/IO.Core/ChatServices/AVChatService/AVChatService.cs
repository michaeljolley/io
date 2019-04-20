using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Hosting;

using TwitchLib.Client;
using TwitchLib.Client.Models;

namespace IO.Core.ChatServices
{
    public class AVChatService : BaseChatService, IChatService
    {
        private Dictionary<string, string> _availableFiles = new Dictionary<string, string>();

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
        }

        // We're not going to publish these commands in our standard !help list
        public List<ChatCommand> AvailableCommands() => new List<ChatCommand>();

        public async Task<string> ProcessMessageAsync(ChatMessage chatMessage)
        {
            string message = chatMessage.Message;

            if (!string.IsNullOrEmpty(message))
            {
                string[] splitMessage = message.Split(null);

                if (_availableFiles.ContainsKey(splitMessage[0].ToLower()))
                {
                    string identifiedClipFileName = _availableFiles[splitMessage[0].ToLower()];

                    if (!string.IsNullOrEmpty(identifiedClipFileName))
                    {
                        return $"av:a={identifiedClipFileName}";
                    }
                }
                else if (splitMessage[0].Equals("!stop", StringComparison.InvariantCultureIgnoreCase))
                {
                    return "av:stop";
                }
            }
            return string.Empty;
        }
    }
}
