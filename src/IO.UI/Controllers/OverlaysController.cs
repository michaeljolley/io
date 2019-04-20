using Microsoft.AspNetCore.Mvc;

using IO.Core;

namespace IO.UI.Controllers
{
    public class OverlaysController : Controller
    {
        public IActionResult Emote()
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

        public IActionResult Audio()
        {
            return View();
        }
    }
}
