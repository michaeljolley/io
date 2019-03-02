FROM microsoft/dotnet:2.2-runtime AS base
WORKDIR /app


FROM microsoft/dotnet:2.2-sdk AS build
WORKDIR /src
COPY src/B3Bot/B3Bot.csproj src/B3Bot/
COPY src/B3Bot.Core/B3Bot.Core.csproj src/B3Bot.Core/
RUN dotnet restore src/B3Bot/B3Bot.csproj
COPY . .
WORKDIR /src/src/B3Bot
RUN dotnet build B3Bot.csproj -c Release -o /app

FROM build AS publish
RUN dotnet publish B3Bot.csproj -c Release -o /app

FROM base AS final
WORKDIR /app
COPY --from=publish /app .
ENTRYPOINT ["dotnet", "B3Bot.dll"]