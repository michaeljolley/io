using System;using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

using TwitchLib.Api;
using TwitchLib.Client;

using IO.Core;
using IO.Core.ChatServices;
using IO.Core.SignalR;

namespace IO.UI
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
            services.AddMvc().SetCompatibilityVersion(CompatibilityVersion.Version_2_2);

            // Setup the TwitchAPI and add to service collection for use later
            // in IChatServices that may be registered and need it.
            TwitchAPI twitchAPI = new TwitchAPI();
            twitchAPI.Settings.ClientId = Constants.TwitchAPIClientId;
            twitchAPI.Settings.Secret = Constants.TwitchAPIClientSecret;
            twitchAPI.Settings.AccessToken = Constants.TwitchChannelAccessToken;
            services.AddSingleton(twitchAPI);

            services.AddSingleton<StreamAnalytics>();
            services.AddSingleton<TwitchClient>();

            // Add all IChatService's that we want to use in processing incoming
            // chat messages from Twitch IRC channel
            services.AddSingleton<IChatService, BasicCommandChatService>();
            services.AddSingleton<IChatService, AVChatService>();
            //services.AddSingleton<IChatService, NakedChatService>();
            services.AddSingleton<IChatService, ShameChatService>();
            services.AddSingleton<IChatService, ShoutOutChatService>();
            services.AddSingleton<IChatService, UptimeChatService>();
            services.AddSingleton<IChatService, HelpChatService>();

            services.AddSignalR(config =>
            {
                config.EnableDetailedErrors = true;
            });

            services.AddHostedService<IoBot>();
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
                routes.MapHub<AlertHub>("/IO-Alert");
                routes.MapHub<AVHub>("/IO-AV");
                routes.MapHub<ChatHub>("/IO-Chat");
                routes.MapHub<NakedHub>("/IO-Naked");
                routes.MapHub<OverlayHub>("/IO-Overlay");
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
