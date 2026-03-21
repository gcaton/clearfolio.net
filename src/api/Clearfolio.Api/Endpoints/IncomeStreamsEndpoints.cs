using Microsoft.EntityFrameworkCore;
using Clearfolio.Api.Data;
using Clearfolio.Api.Helpers;
using Clearfolio.Api.DTOs;
using Clearfolio.Api.Filters;
using Clearfolio.Api.Models;

namespace Clearfolio.Api.Endpoints;

public static class IncomeStreamsEndpoints
{
    private static readonly HashSet<string> ValidFrequencies = new(StringComparer.OrdinalIgnoreCase)
        { "weekly", "fortnightly", "monthly", "quarterly", "yearly" };

    public static WebApplication MapIncomeStreamsEndpoints(this WebApplication app)
    {
        app.MapGet("/api/income-streams", GetIncomeStreams);
        app.MapPost("/api/income-streams", CreateIncomeStream).AddEndpointFilter<ValidationFilter<CreateIncomeStreamRequest>>();
        app.MapPut("/api/income-streams/{id:guid}", UpdateIncomeStream).AddEndpointFilter<ValidationFilter<UpdateIncomeStreamRequest>>();
        app.MapDelete("/api/income-streams/{id:guid}", DeleteIncomeStream);
        return app;
    }

    private static async Task<IResult> GetIncomeStreams(HttpContext context, ClearfolioDbContext db)
    {
        var member = GetMemberOrNull(context);
        if (member is null) return Results.Unauthorized();

        var items = await db.IncomeStreams
            .AsNoTracking()
            .Include(i => i.OwnerMember)
            .Where(i => i.HouseholdId == member.HouseholdId && i.IsActive)
            .OrderBy(i => i.IncomeType == "Primary" ? 0 : 1) // Primary first
            .ThenBy(i => i.OwnerMember!.MemberTag)
            .ThenBy(i => i.Label)
            .ToListAsync();

        return Results.Ok(items.Select(ToDto));
    }

    private static async Task<IResult> CreateIncomeStream(CreateIncomeStreamRequest request, HttpContext context, ClearfolioDbContext db)
    {
        var member = GetMemberOrNull(context);
        if (member is null) return Results.Unauthorized();

        var label = request.Label?.Trim();
        if (string.IsNullOrEmpty(label) || label.Length > 200)
            return ApiErrors.BadRequest("Label is required and must be 200 characters or fewer.");
        if (request.Amount <= 0)
            return ApiErrors.BadRequest("Amount must be greater than 0.");
        if (!ValidFrequencies.Contains(request.Frequency))
            return ApiErrors.BadRequest($"Frequency must be one of: {string.Join(", ", ValidFrequencies)}.");
        if (request.IncomeType is not ("Primary" or "Additional"))
            return ApiErrors.BadRequest("IncomeType must be 'Primary' or 'Additional'.");
        if (request.Notes?.Length > 1000)
            return ApiErrors.BadRequest("Notes must be 1000 characters or fewer.");

        // Enforce one primary per member
        if (request.IncomeType == "Primary")
        {
            var hasPrimary = await db.IncomeStreams.AnyAsync(i =>
                i.HouseholdId == member.HouseholdId &&
                i.OwnerMemberId == request.OwnerMemberId &&
                i.IncomeType == "Primary" &&
                i.IsActive);
            if (hasPrimary)
                return Results.Conflict("This member already has a primary income stream.");
        }

        var now = DateTime.UtcNow.ToString("o");
        var item = new IncomeStream
        {
            Id = Guid.NewGuid(),
            HouseholdId = member.HouseholdId,
            OwnerMemberId = request.OwnerMemberId,
            Label = label,
            IncomeType = request.IncomeType,
            Amount = request.Amount,
            Frequency = request.Frequency,
            IsActive = request.IsActive,
            Notes = request.Notes,
            CreatedAt = now,
            UpdatedAt = now
        };

        db.IncomeStreams.Add(item);
        await db.SaveChangesAsync();

        await db.Entry(item).Reference(i => i.OwnerMember).LoadAsync();
        return Results.Created($"/api/income-streams/{item.Id}", ToDto(item));
    }

    private static async Task<IResult> UpdateIncomeStream(Guid id, UpdateIncomeStreamRequest request, HttpContext context, ClearfolioDbContext db)
    {
        var member = GetMemberOrNull(context);
        if (member is null) return Results.Unauthorized();

        var item = await db.IncomeStreams
            .Include(i => i.OwnerMember)
            .FirstOrDefaultAsync(i => i.Id == id && i.HouseholdId == member.HouseholdId);
        if (item is null) return Results.NotFound();

        var label = request.Label?.Trim();
        if (string.IsNullOrEmpty(label) || label.Length > 200)
            return ApiErrors.BadRequest("Label is required and must be 200 characters or fewer.");
        if (request.Amount <= 0)
            return ApiErrors.BadRequest("Amount must be greater than 0.");
        if (!ValidFrequencies.Contains(request.Frequency))
            return ApiErrors.BadRequest($"Frequency must be one of: {string.Join(", ", ValidFrequencies)}.");
        if (request.IncomeType is not ("Primary" or "Additional"))
            return ApiErrors.BadRequest("IncomeType must be 'Primary' or 'Additional'.");
        if (request.Notes?.Length > 1000)
            return ApiErrors.BadRequest("Notes must be 1000 characters or fewer.");

        // Enforce one primary per member (exclude self)
        if (request.IncomeType == "Primary")
        {
            var hasPrimary = await db.IncomeStreams.AnyAsync(i =>
                i.HouseholdId == member.HouseholdId &&
                i.OwnerMemberId == request.OwnerMemberId &&
                i.IncomeType == "Primary" &&
                i.IsActive &&
                i.Id != id);
            if (hasPrimary)
                return Results.Conflict("This member already has a primary income stream.");
        }

        item.OwnerMemberId = request.OwnerMemberId;
        item.Label = label;
        item.IncomeType = request.IncomeType;
        item.Amount = request.Amount;
        item.Frequency = request.Frequency;
        item.IsActive = request.IsActive;
        item.Notes = request.Notes;
        item.UpdatedAt = DateTime.UtcNow.ToString("o");

        await db.SaveChangesAsync();

        await db.Entry(item).Reference(i => i.OwnerMember).LoadAsync();
        return Results.Ok(ToDto(item));
    }

    private static async Task<IResult> DeleteIncomeStream(Guid id, HttpContext context, ClearfolioDbContext db)
    {
        var member = GetMemberOrNull(context);
        if (member is null) return Results.Unauthorized();

        var item = await db.IncomeStreams.FirstOrDefaultAsync(i => i.Id == id && i.HouseholdId == member.HouseholdId);
        if (item is null) return Results.NotFound();

        item.IsActive = false;
        item.UpdatedAt = DateTime.UtcNow.ToString("o");
        await db.SaveChangesAsync();

        return Results.NoContent();
    }

    private static IncomeStreamDto ToDto(IncomeStream i) => new(
        i.Id, i.OwnerMemberId, i.OwnerMember?.DisplayName,
        i.Label, i.IncomeType, i.Amount, i.Frequency,
        i.IsActive, i.Notes, i.CreatedAt, i.UpdatedAt);

    private static HouseholdMember? GetMemberOrNull(HttpContext context) =>
        context.Items["HouseholdMember"] as HouseholdMember;
}
