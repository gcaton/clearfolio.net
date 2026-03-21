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

            // Clean up any categories with malformed IDs from previous migration runs,
            // then re-insert with proper lowercase GUIDs matching EF Core format
            migrationBuilder.Sql("DELETE FROM expense_categories");

            var now = DateTime.UtcNow.ToString("o");

            foreach (var (name, sortOrder) in categories)
            {
                migrationBuilder.Sql($"""
                    INSERT INTO expense_categories (id, household_id, name, sort_order, is_default, created_at)
                    SELECT
                        lower(
                            hex(randomblob(4)) || '-' ||
                            hex(randomblob(2)) || '-' ||
                            '4' || substr(hex(randomblob(2)), 2) || '-' ||
                            substr('89ab', 1 + (abs(random()) % 4), 1) || substr(hex(randomblob(2)), 2) || '-' ||
                            hex(randomblob(6))
                        ),
                        h.id,
                        '{name}',
                        {sortOrder},
                        1,
                        '{now}'
                    FROM households h
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
