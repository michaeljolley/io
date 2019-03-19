FROM microsoft/dotnet:2.2-aspnetcore-runtime AS base
WORKDIR /app
EXPOSE 80
EXPOSE 443

FROM microsoft/dotnet:2.2-sdk AS build
WORKDIR /src
COPY ["src/B3Bot.UI/B3Bot.UI.csproj", "src/B3Bot.UI/"]
COPY ["src/B3Bot.Core/B3Bot.Core.csproj", "src/B3Bot.Core/"]
RUN dotnet restore "src/B3Bot.UI/B3Bot.UI.csproj"
COPY . .
WORKDIR "/src/src/B3Bot.UI"
RUN dotnet build "B3Bot.UI.csproj" -c Release -o /app

FROM build AS publish
RUN dotnet publish "B3Bot.UI.csproj" -c Release -o /app

FROM base AS final
WORKDIR /app
COPY --from=publish /app .
ENTRYPOINT ["dotnet", "B3Bot.UI.dll"]