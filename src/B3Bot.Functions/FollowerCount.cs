using System;
using System.IO;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Azure.WebJobs;
using Microsoft.Azure.WebJobs.Extensions.Http;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using Newtonsoft.Json;
using B3Bot.Core;

namespace B3Bot.Functions
{
    public static class FollowerCount
    {
        [FunctionName("FollowerCount")]
        public static async Task<IActionResult> Run(
            [HttpTrigger(AuthorizationLevel.Function, "get", Route = null)] HttpRequest req,
            ILogger log)
        {
            int.TryParse(Environment.GetEnvironmentVariable("followerCountRefresh"), out int refreshFrequency);

            refreshFrequency = refreshFrequency == 0 ? 10000 : refreshFrequency;

            StreamAnalytics streamAnalytics = new StreamAnalytics();

            int followerCount = await streamAnalytics.GetFollowerCountAsync();

            string content = "<html><head><script>setTimeout(function() {location.reload(); }, " + refreshFrequency + ");</script><style>body { font-family: 'Open Sans', Arial; font-size: 36px; font-weight: 600; color: #fff; background: #47096B; } div { display: inline; margin-top: -2px;margin-left: 10px; position: absolute; }</style></head><body><svg xmlns='http://www.w3.org/2000/svg' width='36' height='36' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round' class='feather feather-users'><path d='M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2'></path><circle cx='9' cy='7' r='4'></circle><path d='M23 21v-2a4 4 0 0 0-3-3.87'></path><path d='M16 3.13a4 4 0 0 1 0 7.75'></path></svg><div>" + followerCount.ToString("N0") + "</div></body></html>";

            return new ContentResult() { Content = content, StatusCode = 200, ContentType = "text/html" };
        }
    }
}
