using Microsoft.EntityFrameworkCore;
using Clearfolio.Api.Data;
using Clearfolio.Api.Helpers;
using Clearfolio.Api.DTOs;
using Clearfolio.Api.Filters;
using Clearfolio.Api.Models;

namespace Clearfolio.Api.Endpoints;

public static class SnapshotsEndpoints
{
    public static WebApplication MapSnapshotsEndpoints(this WebApplication app)
    {
        app.MapGet("/api/snapshots", GetSnapshots);
        app.MapPost("/api/snapshots", UpsertSnapshot).AddEndpointFilter<ValidationFilter<CreateSnapshotRequest>>();
        app.MapPut("/api/snapshots/{id:guid}", UpdateSnapshot).AddEndpointFilter<ValidationFilter<UpdateSnapshotRequest>>();
        app.MapDelete("/api/snapshots/{id:guid}", DeleteSnapshot);
        app.MapGet("/api/periods", GetPeriods);
        app.MapGet("/api/snapshots/latest", GetLatestSnapshots);
        return app;
    }

    private static async Task<IResult> GetSnapshots(HttpContext context, ClearfolioDbContext db, string? period = null, Guid? entityId = null)
    {
        var member = context.GetMemberOrNull();
        if (member is null) return Results.Unauthorized();

        var query = db.Snapshots
            .AsNoTracking()
            .Include(s => s.RecordedByMember)
            .Where(s => s.HouseholdId == member.HouseholdId);

        if (period is not null)
            query = query.Where(s => s.Period == period);

        if (entityId is not null)
            query = query.Where(s => s.EntityId == entityId);

        var snapshots = await query
            .OrderBy(s => s.Period)
            .ThenBy(s => s.EntityType)
            .Select(s => ToDto(s))
            .ToListAsync();

        return Results.Ok(snapshots);
    }

    private static async Task<IResult> UpsertSnapshot(CreateSnapshotRequest request, HttpContext context, ClearfolioDbContext db)
    {
        var member = context.GetMemberOrNull();
        if (member is null) return Results.Unauthorized();

        if (request.EntityType is not ("asset" or "liability"))
            return ApiErrors.BadRequest("entityType must be 'asset' or 'liability'");

        var existing = await db.Snapshots
            .FirstOrDefaultAsync(s =>
                s.HouseholdId == member.HouseholdId &&
                s.EntityId == request.EntityId &&
                s.Period == request.Period);

        if (existing is not null)
        {
            existing.Value = request.Value;
            existing.Currency = request.Currency;
            existing.Notes = request.Notes;
            existing.RecordedBy = member.Id;
            existing.RecordedAt = DateTime.UtcNow.ToString("o");

            await db.SaveChangesAsync();
            await db.Entry(existing).Reference(s => s.RecordedByMember).LoadAsync();

            return Results.Ok(ToDto(existing));
        }

        var snapshot = new Snapshot
        {
            Id = Guid.NewGuid(),
            HouseholdId = member.HouseholdId,
            EntityId = request.EntityId,
            EntityType = request.EntityType,
            Period = request.Period,
            Value = request.Value,
            Currency = request.Currency,
            Notes = request.Notes,
            RecordedBy = member.Id,
            RecordedAt = DateTime.UtcNow.ToString("o")
        };

        db.Snapshots.Add(snapshot);
        await db.SaveChangesAsync();

        await db.Entry(snapshot).Reference(s => s.RecordedByMember).LoadAsync();

        return Results.Created($"/api/snapshots/{snapshot.Id}", ToDto(snapshot));
    }

    private static async Task<IResult> UpdateSnapshot(Guid id, UpdateSnapshotRequest request, HttpContext context, ClearfolioDbContext db)
    {
        var member = context.GetMemberOrNull();
        if (member is null) return Results.Unauthorized();

        var snapshot = await db.Snapshots
            .Include(s => s.RecordedByMember)
            .FirstOrDefaultAsync(s => s.Id == id && s.HouseholdId == member.HouseholdId);

        if (snapshot is null) return Results.NotFound();

        snapshot.Value = request.Value;
        snapshot.Currency = request.Currency;
        snapshot.Notes = request.Notes;
        snapshot.RecordedBy = member.Id;
        snapshot.RecordedAt = DateTime.UtcNow.ToString("o");

        await db.SaveChangesAsync();

        return Results.Ok(ToDto(snapshot));
    }

    private static async Task<IResult> DeleteSnapshot(Guid id, HttpContext context, ClearfolioDbContext db)
    {
        var member = context.GetMemberOrNull();
        if (member is null) return Results.Unauthorized();

        var snapshot = await db.Snapshots
            .FirstOrDefaultAsync(s => s.Id == id && s.HouseholdId == member.HouseholdId);

        if (snapshot is null) return Results.NotFound();

        db.Snapshots.Remove(snapshot);
        await db.SaveChangesAsync();

        return Results.NoContent();
    }

    private static async Task<IResult> GetPeriods(HttpContext context, ClearfolioDbContext db)
    {
        var member = context.GetMemberOrNull();
        if (member is null) return Results.Unauthorized();

        var periods = await db.Snapshots
            .AsNoTracking()
            .Where(s => s.HouseholdId == member.HouseholdId)
            .Select(s => s.Period)
            .Distinct()
            .OrderByDescending(p => p)
            .ToListAsync();

        return Results.Ok(periods);
    }

    private static async Task<IResult> GetLatestSnapshots(HttpContext context, ClearfolioDbContext db)
    {
        var member = context.GetMemberOrNull();
        if (member is null) return Results.Unauthorized();

        var allSnapshots = await db.Snapshots
            .AsNoTracking()
            .Where(s => s.HouseholdId == member.HouseholdId)
            .ToListAsync();

        var latest = allSnapshots
            .GroupBy(s => s.EntityId)
            .Select(g => g.OrderByDescending(s => s.Period).First())
            .Select(s => new LatestSnapshotDto(s.EntityId, s.EntityType, s.Period, s.Value, s.Currency))
            .ToList();

        return Results.Ok(latest);
    }

    private static SnapshotDto ToDto(Snapshot s) => new(
        s.Id, s.EntityId, s.EntityType,
        s.Period, s.Value, s.Currency, s.Notes,
        s.RecordedBy, s.RecordedByMember.DisplayName, s.RecordedAt);

}
