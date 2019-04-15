using System;

namespace IO.Core.ChatServices
{
    public class BasicChatCommand : ChatCommand
    {
        public BasicChatCommand(string command, string value, string format, int throttleInSeconds, bool isLocked = true) 
            : base(command, format, isLocked)
        {
            Value = value;
        }

        public string Value { get; set; }
    }
}
