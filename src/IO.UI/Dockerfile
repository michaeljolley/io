FROM microsoft/dotnet:2.2-aspnetcore-runtime AS base
WORKDIR /app
EXPOSE 80
EXPOSE 443

FROM microsoft/dotnet:2.2-sdk AS build
WORKDIR /src
COPY ["src/IO.UI/IO.UI.csproj", "src/IO.UI/"]
COPY ["src/IO.Core/IO.Core.csproj", "src/IO.Core/"]
RUN dotnet restore "src/IO.UI/IO.UI.csproj"
COPY . .
WORKDIR "/src/src/IO.UI"
RUN dotnet build "IO.UI.csproj" -c Release -o /app

FROM build AS publish
RUN dotnet publish "IO.UI.csproj" -c Release -o /app

FROM base AS final
WORKDIR /app
COPY --from=publish /app .
ENTRYPOINT ["dotnet", "IO.UI.dll"]
