using Microsoft.EntityFrameworkCore;
using Clearfolio.Api.Data;
using Clearfolio.Api.Helpers;
using Clearfolio.Api.DTOs;
using Clearfolio.Api.Filters;
using Clearfolio.Api.Models;

namespace Clearfolio.Api.Endpoints;

public static class ExpensesEndpoints
{
    private static readonly HashSet<string> ValidFrequencies = new(StringComparer.OrdinalIgnoreCase)
        { "weekly", "fortnightly", "monthly", "quarterly", "yearly" };

    public static WebApplication MapExpensesEndpoints(this WebApplication app)
    {
        app.MapGet("/api/expenses", GetExpenses);
        app.MapPost("/api/expenses", CreateExpense).AddEndpointFilter<ValidationFilter<CreateExpenseRequest>>();
        app.MapPut("/api/expenses/{id:guid}", UpdateExpense).AddEndpointFilter<ValidationFilter<UpdateExpenseRequest>>();
        app.MapDelete("/api/expenses/{id:guid}", DeleteExpense);
        return app;
    }

    private static async Task<IResult> GetExpenses(HttpContext context, ClearfolioDbContext db)
    {
        var member = GetMemberOrNull(context);
        if (member is null) return Results.Unauthorized();

        var items = await db.Expenses
            .AsNoTracking()
            .Include(e => e.OwnerMember)
            .Include(e => e.ExpenseCategory)
            .Where(e => e.HouseholdId == member.HouseholdId && e.IsActive)
            .OrderBy(e => e.ExpenseCategory.SortOrder)
            .ThenBy(e => e.Label)
            .ToListAsync();

        return Results.Ok(items.Select(ToDto));
    }

    private static async Task<IResult> CreateExpense(CreateExpenseRequest request, HttpContext context, ClearfolioDbContext db)
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
        if (request.Notes?.Length > 1000)
            return ApiErrors.BadRequest("Notes must be 1000 characters or fewer.");

        // Verify category belongs to household
        var categoryExists = await db.ExpenseCategories.AnyAsync(c =>
            c.Id == request.ExpenseCategoryId && c.HouseholdId == member.HouseholdId);
        if (!categoryExists)
            return ApiErrors.BadRequest("Invalid expense category.");

        var now = DateTime.UtcNow.ToString("o");
        var item = new Expense
        {
            Id = Guid.NewGuid(),
            HouseholdId = member.HouseholdId,
            OwnerMemberId = request.OwnerMemberId,
            ExpenseCategoryId = request.ExpenseCategoryId,
            Label = label,
            Amount = request.Amount,
            Frequency = request.Frequency,
            IsActive = request.IsActive,
            Notes = request.Notes,
            CreatedAt = now,
            UpdatedAt = now
        };

        db.Expenses.Add(item);
        await db.SaveChangesAsync();

        await db.Entry(item).Reference(e => e.ExpenseCategory).LoadAsync();
        if (item.OwnerMemberId is not null)
            await db.Entry(item).Reference(e => e.OwnerMember).LoadAsync();

        return Results.Created($"/api/expenses/{item.Id}", ToDto(item));
    }

    private static async Task<IResult> UpdateExpense(Guid id, UpdateExpenseRequest request, HttpContext context, ClearfolioDbContext db)
    {
        var member = GetMemberOrNull(context);
        if (member is null) return Results.Unauthorized();

        var item = await db.Expenses
            .Include(e => e.ExpenseCategory)
            .Include(e => e.OwnerMember)
            .FirstOrDefaultAsync(e => e.Id == id && e.HouseholdId == member.HouseholdId);
        if (item is null) return Results.NotFound();

        var label = request.Label?.Trim();
        if (string.IsNullOrEmpty(label) || label.Length > 200)
            return ApiErrors.BadRequest("Label is required and must be 200 characters or fewer.");
        if (request.Amount <= 0)
            return ApiErrors.BadRequest("Amount must be greater than 0.");
        if (!ValidFrequencies.Contains(request.Frequency))
            return ApiErrors.BadRequest($"Frequency must be one of: {string.Join(", ", ValidFrequencies)}.");
        if (request.Notes?.Length > 1000)
            return ApiErrors.BadRequest("Notes must be 1000 characters or fewer.");

        var categoryExists = await db.ExpenseCategories.AnyAsync(c =>
            c.Id == request.ExpenseCategoryId && c.HouseholdId == member.HouseholdId);
        if (!categoryExists)
            return ApiErrors.BadRequest("Invalid expense category.");

        item.OwnerMemberId = request.OwnerMemberId;
        item.ExpenseCategoryId = request.ExpenseCategoryId;
        item.Label = label;
        item.Amount = request.Amount;
        item.Frequency = request.Frequency;
        item.IsActive = request.IsActive;
        item.Notes = request.Notes;
        item.UpdatedAt = DateTime.UtcNow.ToString("o");

        await db.SaveChangesAsync();

        await db.Entry(item).Reference(e => e.ExpenseCategory).LoadAsync();
        if (item.OwnerMemberId is not null)
            await db.Entry(item).Reference(e => e.OwnerMember).LoadAsync();

        return Results.Ok(ToDto(item));
    }

    private static async Task<IResult> DeleteExpense(Guid id, HttpContext context, ClearfolioDbContext db)
    {
        var member = GetMemberOrNull(context);
        if (member is null) return Results.Unauthorized();

        var item = await db.Expenses.FirstOrDefaultAsync(e => e.Id == id && e.HouseholdId == member.HouseholdId);
        if (item is null) return Results.NotFound();

        item.IsActive = false;
        item.UpdatedAt = DateTime.UtcNow.ToString("o");
        await db.SaveChangesAsync();

        return Results.NoContent();
    }

    private static ExpenseDto ToDto(Expense e) => new(
        e.Id, e.OwnerMemberId, e.OwnerMember?.DisplayName,
        e.ExpenseCategoryId, e.ExpenseCategory.Name,
        e.Label, e.Amount, e.Frequency,
        e.IsActive, e.Notes, e.CreatedAt, e.UpdatedAt);

    private static HouseholdMember? GetMemberOrNull(HttpContext context) =>
        context.Items["HouseholdMember"] as HouseholdMember;
}
