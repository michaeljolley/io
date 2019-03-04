using System;
using System.Collections.Generic;
using System.Text;

namespace B3Bot.Core.ChatServices
{
    public class ChatCommand
    {
        public ChatCommand(string command, string format, bool? isLocked = false)
        {
            Command = command;
            Format = format;
            IsLocked = isLocked.GetValueOrDefault(false);
        }

        public string Command { get; set; }
        public string Format { get; set; }
        public bool IsLocked { get; set; }
    }
}
