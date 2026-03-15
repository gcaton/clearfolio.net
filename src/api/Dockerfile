FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

COPY Clearfolio.Api/Clearfolio.Api.csproj Clearfolio.Api/
RUN dotnet restore Clearfolio.Api/Clearfolio.Api.csproj

COPY . .
RUN dotnet publish Clearfolio.Api/Clearfolio.Api.csproj -c Release -o /app/publish

FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app
COPY --from=build /app/publish .

EXPOSE 8080
ENTRYPOINT ["dotnet", "Clearfolio.Api.dll"]
