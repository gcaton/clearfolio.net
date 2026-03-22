using Microsoft.EntityFrameworkCore;
using Clearfolio.Api.Data;
using Clearfolio.Api.Helpers;
using Clearfolio.Api.DTOs;
using Clearfolio.Api.Filters;
using Clearfolio.Api.Models;

namespace Clearfolio.Api.Endpoints;

public static class ExpenseCategoriesEndpoints
{
    public static WebApplication MapExpenseCategoriesEndpoints(this WebApplication app)
    {
        app.MapGet("/api/expense-categories", GetCategories);
        app.MapPost("/api/expense-categories", CreateCategory).AddEndpointFilter<ValidationFilter<CreateExpenseCategoryRequest>>();
        app.MapPut("/api/expense-categories/{id:guid}", UpdateCategory).AddEndpointFilter<ValidationFilter<UpdateExpenseCategoryRequest>>();
        app.MapDelete("/api/expense-categories/{id:guid}", DeleteCategory);
        return app;
    }

    private static readonly string[] DefaultCategories =
    [
        "Housing", "Utilities", "Transport", "Insurance", "Subscriptions",
        "Food & Groceries", "Health", "Personal", "Education", "Other"
    ];

    public static void SeedDefaultCategories(ClearfolioDbContext db, Guid householdId)
    {
        var now = DateTime.UtcNow.ToString("o");
        for (var i = 0; i < DefaultCategories.Length; i++)
        {
            db.ExpenseCategories.Add(new ExpenseCategory
            {
                Id = Guid.NewGuid(),
                HouseholdId = householdId,
                Name = DefaultCategories[i],
                SortOrder = i + 1,
                IsDefault = true,
                CreatedAt = now
            });
        }
    }

    private static async Task<IResult> GetCategories(HttpContext context, ClearfolioDbContext db)
    {
        var member = context.GetMemberOrNull();
        if (member is null) return Results.Unauthorized();

        var categories = await db.ExpenseCategories
            .AsNoTracking()
            .Where(c => c.HouseholdId == member.HouseholdId)
            .OrderBy(c => c.SortOrder)
            .Select(c => new ExpenseCategoryDto(c.Id, c.Name, c.SortOrder, c.IsDefault, c.CreatedAt))
            .ToListAsync();

        return Results.Ok(categories);
    }

    private static async Task<IResult> CreateCategory(CreateExpenseCategoryRequest request, HttpContext context, ClearfolioDbContext db)
    {
        var member = context.GetMemberOrNull();
        if (member is null) return Results.Unauthorized();

        var name = request.Name?.Trim();
        if (string.IsNullOrEmpty(name) || name.Length > 100)
            return ApiErrors.BadRequest("Name is required and must be 100 characters or fewer.");

        var maxSort = await db.ExpenseCategories
            .Where(c => c.HouseholdId == member.HouseholdId)
            .MaxAsync(c => (int?)c.SortOrder) ?? 0;

        var category = new ExpenseCategory
        {
            Id = Guid.NewGuid(),
            HouseholdId = member.HouseholdId,
            Name = name,
            SortOrder = maxSort + 1,
            IsDefault = false,
            CreatedAt = DateTime.UtcNow.ToString("o")
        };

        db.ExpenseCategories.Add(category);
        await db.SaveChangesAsync();

        return Results.Created($"/api/expense-categories/{category.Id}",
            new ExpenseCategoryDto(category.Id, category.Name, category.SortOrder, category.IsDefault, category.CreatedAt));
    }

    private static async Task<IResult> UpdateCategory(Guid id, UpdateExpenseCategoryRequest request, HttpContext context, ClearfolioDbContext db)
    {
        var member = context.GetMemberOrNull();
        if (member is null) return Results.Unauthorized();

        var category = await db.ExpenseCategories
            .FirstOrDefaultAsync(c => c.Id == id && c.HouseholdId == member.HouseholdId);
        if (category is null) return Results.NotFound();

        var name = request.Name?.Trim();
        if (string.IsNullOrEmpty(name) || name.Length > 100)
            return ApiErrors.BadRequest("Name is required and must be 100 characters or fewer.");

        category.Name = name;
        category.SortOrder = request.SortOrder;
        await db.SaveChangesAsync();

        return Results.Ok(new ExpenseCategoryDto(category.Id, category.Name, category.SortOrder, category.IsDefault, category.CreatedAt));
    }

    private static async Task<IResult> DeleteCategory(Guid id, HttpContext context, ClearfolioDbContext db)
    {
        var member = context.GetMemberOrNull();
        if (member is null) return Results.Unauthorized();

        var category = await db.ExpenseCategories
            .FirstOrDefaultAsync(c => c.Id == id && c.HouseholdId == member.HouseholdId);
        if (category is null) return Results.NotFound();

        if (category.IsDefault)
            return ApiErrors.BadRequest("Cannot delete a default category.");

        var hasExpenses = await db.Expenses.AnyAsync(e => e.ExpenseCategoryId == id);
        if (hasExpenses)
            return ApiErrors.BadRequest("Cannot delete a category that has expenses. Remove or reassign the expenses first.");

        db.ExpenseCategories.Remove(category);
        await db.SaveChangesAsync();

        return Results.NoContent();
    }

}
