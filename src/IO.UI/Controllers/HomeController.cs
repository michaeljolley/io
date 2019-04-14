using System;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;

using IO.Core.SignalR;
using IO.Core.Models;
using TwitchLib.PubSub.Events;
using TwitchLib.PubSub.Models.Responses.Messages;
using TwitchLib.Client.Events;
using TwitchLib.Client.Models;

namespace IO.UI.Controllers
{
    public class HomeController : Controller
    {
        private readonly IHubContext<AlertHub> _hubContext;

        public HomeController(IHubContext<AlertHub> hubContext)
        {
            _hubContext = hubContext;
        }

        public IActionResult Index()
        {
            return View();
        }

        public IActionResult Test()
        {
            return View("Test");
        }

        public async Task<IActionResult> NewFollower()
        {
            StreamUserModel newFollower = new StreamUserModel("123", "WilliamGates", "https://specials-images.forbesimg.com/imageserve/5c76b4b84bbe6f24ad99c370/416x416.jpg?background=000000&cropX1=0&cropX2=4000&cropY1=0&cropY2=4000");
            await _hubContext.Clients.All.SendAsync("ReceiveNewFollower", newFollower);

            return RedirectToAction("test");
        }

        public async Task<IActionResult> NewCheer()
        {
            OnBitsReceivedArgs bitsReceived = new OnBitsReceivedArgs()
            {
                BitsUsed = 10000,
                Username = "williamgates"
            };
            await _hubContext.Clients.All.SendAsync("ReceiveNewCheer", bitsReceived);

            return RedirectToAction("test");
        }

        public async Task<IActionResult> NewSubscriber()
        {
            ChannelSubscription sub = new ChannelSubscription("{'displayName':'WilliamGates'}");

            await _hubContext.Clients.All.SendAsync("ReceiveNewSubscriber", sub);
            return RedirectToAction("test");
        }

        public async Task<IActionResult> NewRaid()
        {
            OnRaidNotificationArgs onRaid = new OnRaidNotificationArgs()
            {
                RaidNotificaiton = new RaidNotification(new TwitchLib.Client.Models.Internal.IrcMessage("williamgates"))
            };

            await _hubContext.Clients.All.SendAsync("ReceiveNewRaid", onRaid);

            return RedirectToAction("test");
        }

        public IActionResult NewHost()
        {


            return RedirectToAction("test");
        }
    }
}
