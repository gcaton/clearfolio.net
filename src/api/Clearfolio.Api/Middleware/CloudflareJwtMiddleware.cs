using System.IdentityModel.Tokens.Jwt;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Protocols;
using Microsoft.IdentityModel.Protocols.OpenIdConnect;
using Microsoft.IdentityModel.Tokens;
using Clearfolio.Api.Data;
using Clearfolio.Api.Models;

namespace Clearfolio.Api.Middleware;

public class CloudflareJwtMiddleware
{
    private readonly RequestDelegate _next;
    private readonly IConfiguration _config;
    private readonly IHostEnvironment _env;
    private readonly ILogger<CloudflareJwtMiddleware> _logger;
    private ConfigurationManager<OpenIdConnectConfiguration>? _configManager;

    public CloudflareJwtMiddleware(RequestDelegate next, IConfiguration config, IHostEnvironment env, ILogger<CloudflareJwtMiddleware> logger)
    {
        _next = next;
        _config = config;
        _env = env;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context, ClearfolioDbContext db)
    {
        var email = await ResolveEmail(context);
        if (email is null)
        {
            context.Response.StatusCode = 401;
            return;
        }

        var member = await db.HouseholdMembers
            .Include(m => m.Household)
            .FirstOrDefaultAsync(m => m.Email == email);

        context.Items["UserEmail"] = email;
        context.Items["HouseholdMember"] = member; // may be null

        await _next(context);
    }

    private async Task<string?> ResolveEmail(HttpContext context)
    {
        if (_env.IsDevelopment())
        {
            return _config["DevAuth:MockUserEmail"];
        }

        if (!context.Request.Headers.TryGetValue("Cf-Access-Jwt-Assertion", out var tokenValues) || tokenValues.Count == 0)
        {
            _logger.LogWarning("Missing Cf-Access-Jwt-Assertion header");
            return null;
        }

        var token = tokenValues.ToString();
        var teamName = _config["Cloudflare:TeamName"] ?? _config["CF_TEAM_NAME"];
        var aud = _config["Cloudflare:AccessApplicationAud"] ?? _config["CF_ACCESS_AUD"];

        if (string.IsNullOrEmpty(teamName) || string.IsNullOrEmpty(aud))
        {
            _logger.LogError("Cloudflare TeamName or AccessApplicationAud not configured");
            return null;
        }

        try
        {
            var issuer = $"https://{teamName}.cloudflareaccess.com";
            var certsUrl = $"{issuer}/cdn-cgi/access/certs";

            _configManager ??= new ConfigurationManager<OpenIdConnectConfiguration>(
                $"{issuer}/.well-known/openid-configuration",
                new OpenIdConnectConfigurationRetriever(),
                new HttpDocumentRetriever { RequireHttps = true });

            // Try OIDC discovery first, fall back to direct JWKS
            OpenIdConnectConfiguration oidcConfig;
            try
            {
                oidcConfig = await _configManager.GetConfigurationAsync(CancellationToken.None);
            }
            catch
            {
                // Cloudflare doesn't always serve standard OIDC discovery — fetch JWKS directly
                var httpRetriever = new HttpDocumentRetriever { RequireHttps = true };
                var jwksJson = await httpRetriever.GetDocumentAsync(certsUrl, CancellationToken.None);
                var jwks = new JsonWebKeySet(jwksJson);
                oidcConfig = new OpenIdConnectConfiguration();
                foreach (var key in jwks.GetSigningKeys())
                {
                    oidcConfig.SigningKeys.Add(key);
                }
            }

            var validationParams = new TokenValidationParameters
            {
                ValidateIssuer = true,
                ValidIssuer = issuer,
                ValidateAudience = true,
                ValidAudience = aud,
                ValidateLifetime = true,
                IssuerSigningKeys = oidcConfig.SigningKeys,
                ValidateIssuerSigningKey = true,
            };

            var handler = new JwtSecurityTokenHandler();
            var principal = handler.ValidateToken(token, validationParams, out _);

            var email = principal.FindFirst("email")?.Value
                ?? principal.FindFirst(System.Security.Claims.ClaimTypes.Email)?.Value;

            if (string.IsNullOrEmpty(email))
            {
                _logger.LogWarning("JWT valid but no email claim found");
                return null;
            }

            return email;
        }
        catch (SecurityTokenException ex)
        {
            _logger.LogWarning(ex, "JWT validation failed");
            return null;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error during JWT validation");
            return null;
        }
    }
}
