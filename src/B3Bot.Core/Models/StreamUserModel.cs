using System;
using System.Collections.Generic;
using System.Text;

namespace B3Bot.Core.Models
{
    public class StreamUserModel
    {
        public StreamUserModel(string displayName, string profileImageUrl)
        {
            DisplayName = displayName;
            ProfileImageUrl = profileImageUrl;
            RefreshMilliseconds = 10000;
        }

        public string DisplayName { get; set; }

        public string ProfileImageUrl { get; set; }
        public int RefreshMilliseconds { get; set; }
    }
}
