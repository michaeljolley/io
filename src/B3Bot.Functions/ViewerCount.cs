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
    public static class ViewerCount
    {
        [FunctionName("ViewerCount")]
        public static async Task<IActionResult> Run(
            [HttpTrigger(AuthorizationLevel.Function, "get", Route = null)] HttpRequest req,
            ILogger log)
        {
            int.TryParse(Environment.GetEnvironmentVariable("viewerCountRefresh"), out int refreshFrequency);

            refreshFrequency = refreshFrequency == 0 ? 15000 : refreshFrequency;

            StreamAnalytics streamAnalytics = new StreamAnalytics();

            int viewerCount = await streamAnalytics.GetViewerCountAsync();

            string content = "<html><head><script>setTimeout(function() {location.reload(); }, " + refreshFrequency + ");</script><style>body { font-family: 'Open Sans', Arial; font-size: 36px; font-weight: 600; color: #fff; background: #47096B; } div { display: inline; margin-top: -2px;margin-left: 10px; position: absolute; }</style></head><body><svg xmlns='http://www.w3.org/2000/svg' width='36' height='36' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round' class='feather feather-eye'><path d='M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z'></path><circle cx='12' cy='12' r='3'></circle></svg><div>" + viewerCount.ToString("N0") + "</div></body></html>";

            return new ContentResult() { Content = content, StatusCode = 200, ContentType = "text/html" };
        }
    }
}
