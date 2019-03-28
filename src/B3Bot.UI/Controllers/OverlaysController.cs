using Microsoft.AspNetCore.Mvc;

using B3Bot.Core;

namespace B3Bot.UI.Controllers
{
    public class OverlaysController : Controller
    {
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

        public IActionResult Followers()
        {
            return View();
        }

        public IActionResult Viewers()
        {
            return View();
        }

        public IActionResult LastFollower()
        {
            return View();
        }

        public IActionResult LastSubscriber()
        {
            return View();
        }
    }
}
