using System;

namespace IO.Core.Models
{
    public class StreamUserModel
    {
        public StreamUserModel(string userId, string displayName, string profileImageUrl)
        {
            Id = userId;
            DisplayName = displayName;
            ProfileImageUrl = profileImageUrl;
        }

        public string Id { get; set; }

        public string DisplayName { get; set; }

        public string ProfileImageUrl { get; set; }
    }
}
