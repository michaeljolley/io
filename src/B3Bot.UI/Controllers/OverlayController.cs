using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;

namespace B3Bot.UI.Controllers
{
    public class OverlayController : Controller
    {
        public IActionResult Index()
        {
            return View();
        }
    }
}
