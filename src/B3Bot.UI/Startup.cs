using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using B3Bot.Core;
using B3Bot.Core.ChatServices;
using B3Bot.Core.Hubs;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.HttpsPolicy;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using TwitchLib.Api;
using TwitchLib.Client;

namespace B3Bot.UI
{
    public class Startup
    {
        public Startup(IConfiguration configuration)
        {
            Configuration = configuration;
        }

        public IConfiguration Configuration { get; }

        // This method gets called by the runtime. Use this method to add services to the container.
        public void ConfigureServices(IServiceCollection services)
        {
            TwitchClient twitchClient = new TwitchClient();
            TwitchAPI twitchAPI = new TwitchAPI();

            services
                    .AddSingleton<IChatService, BasicCommandChatService>()
                    .AddSingleton<IChatService, ShoutOutChatService>()
                    .AddSingleton<IChatService, UptimeChatService>()
                    .AddSingleton<IChatService, EmojiChatService>()
                    .AddSingleton<IChatService, HelpChatService>()
                    .AddSingleton(twitchAPI)
                    .AddSingleton(twitchClient);

            services.AddHostedService<Bot>();

            services.AddMvc().SetCompatibilityVersion(CompatibilityVersion.Version_2_2);

            services.AddSignalR();
        }

        // This method gets called by the runtime. Use this method to configure the HTTP request pipeline.
        public void Configure(IApplicationBuilder app, IHostingEnvironment env)
        {
            if (env.IsDevelopment())
            {
                app.UseDeveloperExceptionPage();
            }
            else
            {
                 app.UseHsts();
            }

            app.UseHttpsRedirection();
            app.UseStaticFiles();

            app.UseSignalR(routes =>
            {
                routes.MapHub<OverlayHub>("/b3BotHub");
            });

            app.UseMvc(routes =>
            {
                routes.MapRoute(
                    name: "default",
                    template: "{controller=Home}/{action=Index}/{id?}");
            });
        }
    }
}
