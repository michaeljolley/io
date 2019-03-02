using System;
using System.Collections.Generic;
using System.Text;

namespace B3Bot.Core.ChatServices
{
    public class BasicCommand
    {
        public BasicCommand(string command, string value, bool isLocked = false)
        {
            Command = command;
            Value = value;
            IsLocked = isLocked;
        }

        public string Command { get; set; }
        public string Value { get; set; }
        public bool IsLocked { get; set; } = false;
    }
}
