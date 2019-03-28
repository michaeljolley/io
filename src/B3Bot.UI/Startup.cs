using System;

using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

using TwitchLib.Api;
using TwitchLib.Client;

using B3Bot.Core;
using B3Bot.Core.ChatServices;
using B3Bot.Core.Hubs;
using B3Bot.Core.PubSub;
using B3Bot.Core.TimedServices;
using Microsoft.AspNetCore.Http.Connections;

namespace B3Bot.UI
{
    public class Startup
    {
        public Startup(IConfiguration configuration)
        {
            Configuration = configuration;
        }

        public IConfiguration Configuration { get; }

        public void ConfigureServices(IServiceCollection services)
        {
            TwitchClient twitchClient = new TwitchClient();
            TwitchAPI twitchAPI = new TwitchAPI();

            services
                    .AddSingleton(twitchAPI)
                    .AddSingleton(twitchClient)
                    .AddSingleton<IChatService, BasicCommandChatService>()
                    .AddSingleton<IChatService, ShoutOutChatService>()
                    .AddSingleton<IChatService, UptimeChatService>()
                    .AddSingleton<IChatService, HelpChatService>()
                    .AddSingleton<StreamAnalytics>()
                    ;

            services.AddHostedService<OverlayHostedService>();
            services.AddHostedService<Bot>();
            services.AddHostedService<BotPubSub>();

            services.AddMvc().SetCompatibilityVersion(CompatibilityVersion.Version_2_2);

            services.AddSignalR();
        }

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
