using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Clearfolio.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddCashflowEntities : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "expense_categories",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "TEXT", nullable: false),
                    household_id = table.Column<Guid>(type: "TEXT", nullable: false),
                    name = table.Column<string>(type: "TEXT", maxLength: 100, nullable: false),
                    sort_order = table.Column<int>(type: "INTEGER", nullable: false),
                    is_default = table.Column<bool>(type: "INTEGER", nullable: false),
                    created_at = table.Column<string>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_expense_categories", x => x.id);
                    table.ForeignKey(
                        name: "FK_expense_categories_households_household_id",
                        column: x => x.household_id,
                        principalTable: "households",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "income_streams",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "TEXT", nullable: false),
                    household_id = table.Column<Guid>(type: "TEXT", nullable: false),
                    owner_member_id = table.Column<Guid>(type: "TEXT", nullable: false),
                    label = table.Column<string>(type: "TEXT", maxLength: 200, nullable: false),
                    income_type = table.Column<string>(type: "TEXT", nullable: false),
                    amount = table.Column<double>(type: "REAL", nullable: false),
                    frequency = table.Column<string>(type: "TEXT", nullable: false),
                    is_active = table.Column<bool>(type: "INTEGER", nullable: false, defaultValue: true),
                    notes = table.Column<string>(type: "TEXT", maxLength: 1000, nullable: true),
                    created_at = table.Column<string>(type: "TEXT", nullable: false),
                    updated_at = table.Column<string>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_income_streams", x => x.id);
                    table.ForeignKey(
                        name: "FK_income_streams_household_members_owner_member_id",
                        column: x => x.owner_member_id,
                        principalTable: "household_members",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_income_streams_households_household_id",
                        column: x => x.household_id,
                        principalTable: "households",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "expenses",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "TEXT", nullable: false),
                    household_id = table.Column<Guid>(type: "TEXT", nullable: false),
                    owner_member_id = table.Column<Guid>(type: "TEXT", nullable: true),
                    expense_category_id = table.Column<Guid>(type: "TEXT", nullable: false),
                    label = table.Column<string>(type: "TEXT", maxLength: 200, nullable: false),
                    amount = table.Column<double>(type: "REAL", nullable: false),
                    frequency = table.Column<string>(type: "TEXT", nullable: false),
                    is_active = table.Column<bool>(type: "INTEGER", nullable: false, defaultValue: true),
                    notes = table.Column<string>(type: "TEXT", maxLength: 1000, nullable: true),
                    created_at = table.Column<string>(type: "TEXT", nullable: false),
                    updated_at = table.Column<string>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_expenses", x => x.id);
                    table.ForeignKey(
                        name: "FK_expenses_expense_categories_expense_category_id",
                        column: x => x.expense_category_id,
                        principalTable: "expense_categories",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_expenses_household_members_owner_member_id",
                        column: x => x.owner_member_id,
                        principalTable: "household_members",
                        principalColumn: "id");
                    table.ForeignKey(
                        name: "FK_expenses_households_household_id",
                        column: x => x.household_id,
                        principalTable: "households",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_expense_categories_household_id",
                table: "expense_categories",
                column: "household_id");

            migrationBuilder.CreateIndex(
                name: "IX_expenses_expense_category_id",
                table: "expenses",
                column: "expense_category_id");

            migrationBuilder.CreateIndex(
                name: "IX_expenses_household_id_is_active",
                table: "expenses",
                columns: new[] { "household_id", "is_active" });

            migrationBuilder.CreateIndex(
                name: "IX_expenses_owner_member_id",
                table: "expenses",
                column: "owner_member_id");

            migrationBuilder.CreateIndex(
                name: "IX_income_streams_household_id_is_active",
                table: "income_streams",
                columns: new[] { "household_id", "is_active" });

            migrationBuilder.CreateIndex(
                name: "IX_income_streams_owner_member_id",
                table: "income_streams",
                column: "owner_member_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "expenses");

            migrationBuilder.DropTable(
                name: "income_streams");

            migrationBuilder.DropTable(
                name: "expense_categories");
        }
    }
}
