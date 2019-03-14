using System;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;

using B3Bot.Core;
using B3Bot.UI.Models;

namespace B3Bot.UI.Controllers
{
    public class OverlaysController : Controller
    {
        private readonly StreamAnalytics _streamAnalytics;

        public OverlaysController(StreamAnalytics streamAnalytics)
        {
            _streamAnalytics = streamAnalytics;
        }

        public IActionResult Index()
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
    }
}
