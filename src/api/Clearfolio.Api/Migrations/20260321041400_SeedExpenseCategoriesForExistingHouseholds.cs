using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Clearfolio.Api.Migrations
{
    /// <inheritdoc />
    public partial class SeedExpenseCategoriesForExistingHouseholds : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // The 10 default categories with sort orders
            var categories = new[]
            {
                ("Housing", 1),
                ("Utilities", 2),
                ("Transport", 3),
                ("Insurance", 4),
                ("Subscriptions", 5),
                ("Food & Groceries", 6),
                ("Health", 7),
                ("Personal", 8),
                ("Education", 9),
                ("Other", 10)
            };

            var now = DateTime.UtcNow.ToString("o");

            foreach (var (name, sortOrder) in categories)
            {
                // Insert for each household that doesn't already have this category
                migrationBuilder.Sql($"""
                    INSERT INTO expense_categories (id, household_id, name, sort_order, is_default, created_at)
                    SELECT
                        lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)),2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)),2) || '-' || hex(randomblob(6))),
                        h.id,
                        '{name}',
                        {sortOrder},
                        1,
                        '{now}'
                    FROM households h
                    WHERE NOT EXISTS (
                        SELECT 1 FROM expense_categories ec
                        WHERE ec.household_id = h.id AND ec.name = '{name}'
                    )
                    """);
            }
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("DELETE FROM expense_categories WHERE is_default = 1");
        }
    }
}
