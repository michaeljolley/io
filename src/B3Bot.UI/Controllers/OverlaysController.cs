using System;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;

using B3Bot.Core;
using B3Bot.UI.Models;
using B3Bot.Core.Models;

namespace B3Bot.UI.Controllers
{
    public class OverlaysController : Controller
    {
        private readonly StreamAnalytics _streamAnalytics;

        public OverlaysController(StreamAnalytics streamAnalytics)
        {
            _streamAnalytics = streamAnalytics;
        }

        public IActionResult Emoji()
        {
            return View();
        }

        public IActionResult Chat()
        {
            return View();
        }

        public IActionResult Alerts()
        {
            return View();
        }

        public async Task<IActionResult> Followers()
        {
            int.TryParse(Environment.GetEnvironmentVariable("followerCountRefresh"), out int refreshFrequency);

            refreshFrequency = refreshFrequency == 0 ? 10000 : refreshFrequency;

            int followerCount = await _streamAnalytics.GetFollowerCountAsync();

            return View(new CountModel(followerCount, refreshFrequency));
        }

        public async Task<IActionResult> Viewers()
        {
            int.TryParse(Environment.GetEnvironmentVariable("viewerCountRefresh"), out int refreshFrequency);

            refreshFrequency = refreshFrequency == 0 ? 15000 : refreshFrequency;

            int viewerCount = await _streamAnalytics.GetViewerCountAsync();

            return View(new CountModel(viewerCount, refreshFrequency));
        }

        public async Task<IActionResult> LastFollower()
        {
            int.TryParse(Environment.GetEnvironmentVariable("lastFollowerRefresh"), out int refreshFrequency);

            refreshFrequency = refreshFrequency == 0 ? 10000 : refreshFrequency;

            StreamUserModel lastFollower = await _streamAnalytics.GetLastFollowerAsync();

            return View(lastFollower);
        }

        public async Task<IActionResult> LastSubscriber()
        {
            int.TryParse(Environment.GetEnvironmentVariable("lastSubscriberRefresh"), out int refreshFrequency);

            refreshFrequency = refreshFrequency == 0 ? 30000 : refreshFrequency;

            StreamUserModel lastSubscriber = await _streamAnalytics.GetLastSubscriberAsync();

            if (lastSubscriber != null)
            {
                return View(lastSubscriber);
            }

            return View(new StreamUserModel(null, null));
        }
    }
}
