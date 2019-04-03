using System;
using System.Collections.Generic;
using System.Text;

namespace IO.Core.Models
{
    public class StreamUserModel
    {
        public StreamUserModel(string displayName, string profileImageUrl)
        {
            DisplayName = displayName;
            ProfileImageUrl = profileImageUrl;
        }

        public string DisplayName { get; set; }

        public string ProfileImageUrl { get; set; }
    }
}
