FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY Macofu.csproj ./
RUN dotnet restore Macofu.csproj
COPY Program.cs Lab.cs OrderStore.cs OrderWorker.cs ./
COPY appsettings.json ./
COPY wwwroot/ ./wwwroot/
RUN dotnet publish Macofu.csproj -c Release --no-restore -o /out /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app
ENV ASPNETCORE_HTTP_PORTS=8080
COPY --from=build /out/ ./
# The learner's source inspector reads the exact source used in this build.
COPY --from=build /src/Program.cs /src/Lab.cs /src/OrderStore.cs /src/OrderWorker.cs ./
RUN mkdir .data && chown app:app .data
USER app
EXPOSE 8080
ENTRYPOINT ["dotnet", "Macofu.dll"]
