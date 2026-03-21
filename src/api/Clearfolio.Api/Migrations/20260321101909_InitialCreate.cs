using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace Clearfolio.Api.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "app_settings",
                columns: table => new
                {
                    key = table.Column<string>(type: "TEXT", nullable: false),
                    value = table.Column<string>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_app_settings", x => x.key);
                });

            migrationBuilder.CreateTable(
                name: "asset_types",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "TEXT", nullable: false),
                    name = table.Column<string>(type: "TEXT", nullable: false),
                    category = table.Column<string>(type: "TEXT", nullable: false),
                    liquidity = table.Column<string>(type: "TEXT", nullable: false),
                    growth_class = table.Column<string>(type: "TEXT", nullable: false),
                    is_super = table.Column<bool>(type: "INTEGER", nullable: false),
                    is_cgt_exempt = table.Column<bool>(type: "INTEGER", nullable: false),
                    sort_order = table.Column<int>(type: "INTEGER", nullable: false),
                    is_system = table.Column<bool>(type: "INTEGER", nullable: false),
                    default_return_rate = table.Column<double>(type: "REAL", nullable: false, defaultValue: 0.0),
                    default_volatility = table.Column<double>(type: "REAL", nullable: false, defaultValue: 0.0)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_asset_types", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "households",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "TEXT", nullable: false),
                    name = table.Column<string>(type: "TEXT", nullable: false),
                    base_currency = table.Column<string>(type: "TEXT", nullable: false, defaultValue: "AUD"),
                    preferred_period_type = table.Column<string>(type: "TEXT", nullable: false, defaultValue: "FY"),
                    created_at = table.Column<string>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_households", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "liability_types",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "TEXT", nullable: false),
                    name = table.Column<string>(type: "TEXT", nullable: false),
                    category = table.Column<string>(type: "TEXT", nullable: false),
                    debt_quality = table.Column<string>(type: "TEXT", nullable: false),
                    is_hecs = table.Column<bool>(type: "INTEGER", nullable: false),
                    sort_order = table.Column<int>(type: "INTEGER", nullable: false),
                    is_system = table.Column<bool>(type: "INTEGER", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_liability_types", x => x.id);
                });

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
                name: "household_members",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "TEXT", nullable: false),
                    household_id = table.Column<Guid>(type: "TEXT", nullable: false),
                    email = table.Column<string>(type: "TEXT", nullable: true),
                    display_name = table.Column<string>(type: "TEXT", nullable: false),
                    member_tag = table.Column<string>(type: "TEXT", nullable: false),
                    is_primary = table.Column<bool>(type: "INTEGER", nullable: false),
                    created_at = table.Column<string>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_household_members", x => x.id);
                    table.ForeignKey(
                        name: "FK_household_members_households_household_id",
                        column: x => x.household_id,
                        principalTable: "households",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "assets",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "TEXT", nullable: false),
                    household_id = table.Column<Guid>(type: "TEXT", nullable: false),
                    asset_type_id = table.Column<Guid>(type: "TEXT", nullable: false),
                    owner_member_id = table.Column<Guid>(type: "TEXT", nullable: true),
                    ownership_type = table.Column<string>(type: "TEXT", nullable: false, defaultValue: "sole"),
                    joint_split = table.Column<double>(type: "REAL", nullable: false, defaultValue: 0.5),
                    label = table.Column<string>(type: "TEXT", nullable: false),
                    symbol = table.Column<string>(type: "TEXT", nullable: true),
                    currency = table.Column<string>(type: "TEXT", nullable: false, defaultValue: "AUD"),
                    notes = table.Column<string>(type: "TEXT", nullable: true),
                    is_active = table.Column<bool>(type: "INTEGER", nullable: false, defaultValue: true),
                    created_at = table.Column<string>(type: "TEXT", nullable: false),
                    updated_at = table.Column<string>(type: "TEXT", nullable: false),
                    contribution_amount = table.Column<double>(type: "REAL", nullable: true),
                    contribution_frequency = table.Column<string>(type: "TEXT", nullable: true),
                    contribution_end_date = table.Column<string>(type: "TEXT", nullable: true),
                    is_pre_tax_contribution = table.Column<bool>(type: "INTEGER", nullable: false, defaultValue: false),
                    expected_return_rate = table.Column<double>(type: "REAL", nullable: true),
                    expected_volatility = table.Column<double>(type: "REAL", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_assets", x => x.id);
                    table.ForeignKey(
                        name: "FK_assets_asset_types_asset_type_id",
                        column: x => x.asset_type_id,
                        principalTable: "asset_types",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_assets_household_members_owner_member_id",
                        column: x => x.owner_member_id,
                        principalTable: "household_members",
                        principalColumn: "id");
                    table.ForeignKey(
                        name: "FK_assets_households_household_id",
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
                name: "liabilities",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "TEXT", nullable: false),
                    household_id = table.Column<Guid>(type: "TEXT", nullable: false),
                    liability_type_id = table.Column<Guid>(type: "TEXT", nullable: false),
                    owner_member_id = table.Column<Guid>(type: "TEXT", nullable: true),
                    ownership_type = table.Column<string>(type: "TEXT", nullable: false, defaultValue: "sole"),
                    joint_split = table.Column<double>(type: "REAL", nullable: false, defaultValue: 0.5),
                    label = table.Column<string>(type: "TEXT", nullable: false),
                    currency = table.Column<string>(type: "TEXT", nullable: false, defaultValue: "AUD"),
                    notes = table.Column<string>(type: "TEXT", nullable: true),
                    is_active = table.Column<bool>(type: "INTEGER", nullable: false, defaultValue: true),
                    created_at = table.Column<string>(type: "TEXT", nullable: false),
                    updated_at = table.Column<string>(type: "TEXT", nullable: false),
                    repayment_amount = table.Column<double>(type: "REAL", nullable: true),
                    repayment_frequency = table.Column<string>(type: "TEXT", nullable: true),
                    repayment_end_date = table.Column<string>(type: "TEXT", nullable: true),
                    interest_rate = table.Column<double>(type: "REAL", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_liabilities", x => x.id);
                    table.ForeignKey(
                        name: "FK_liabilities_household_members_owner_member_id",
                        column: x => x.owner_member_id,
                        principalTable: "household_members",
                        principalColumn: "id");
                    table.ForeignKey(
                        name: "FK_liabilities_households_household_id",
                        column: x => x.household_id,
                        principalTable: "households",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_liabilities_liability_types_liability_type_id",
                        column: x => x.liability_type_id,
                        principalTable: "liability_types",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "snapshots",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "TEXT", nullable: false),
                    household_id = table.Column<Guid>(type: "TEXT", nullable: false),
                    entity_id = table.Column<Guid>(type: "TEXT", nullable: false),
                    entity_type = table.Column<string>(type: "TEXT", nullable: false),
                    period = table.Column<string>(type: "TEXT", nullable: false),
                    value = table.Column<double>(type: "REAL", nullable: false),
                    currency = table.Column<string>(type: "TEXT", nullable: false, defaultValue: "AUD"),
                    notes = table.Column<string>(type: "TEXT", nullable: true),
                    recorded_by = table.Column<Guid>(type: "TEXT", nullable: false),
                    recorded_at = table.Column<string>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_snapshots", x => x.id);
                    table.ForeignKey(
                        name: "FK_snapshots_household_members_recorded_by",
                        column: x => x.recorded_by,
                        principalTable: "household_members",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_snapshots_households_household_id",
                        column: x => x.household_id,
                        principalTable: "households",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.InsertData(
                table: "asset_types",
                columns: new[] { "id", "category", "default_return_rate", "default_volatility", "growth_class", "is_cgt_exempt", "is_super", "is_system", "liquidity", "name", "sort_order" },
                values: new object[,]
                {
                    { new Guid("a0000000-0000-0000-0000-000000000001"), "cash", 0.040000000000000001, 0.01, "defensive", false, false, true, "immediate", "Cash — savings / transaction", 1 },
                    { new Guid("a0000000-0000-0000-0000-000000000002"), "cash", 0.040000000000000001, 0.01, "defensive", false, false, true, "short_term", "Cash — term deposit (≤90 days)", 2 },
                    { new Guid("a0000000-0000-0000-0000-000000000003"), "cash", 0.044999999999999998, 0.01, "defensive", false, false, true, "long_term", "Term deposit (>90 days)", 3 },
                    { new Guid("a0000000-0000-0000-0000-000000000004"), "investable", 0.070000000000000007, 0.14999999999999999, "growth", false, false, true, "short_term", "Australian shares / ETFs", 4 },
                    { new Guid("a0000000-0000-0000-0000-000000000005"), "investable", 0.080000000000000002, 0.17000000000000001, "growth", false, false, true, "short_term", "International shares / ETFs", 5 },
                    { new Guid("a0000000-0000-0000-0000-000000000006"), "investable", 0.040000000000000001, 0.050000000000000003, "defensive", false, false, true, "short_term", "Bonds / fixed income", 7 }
                });

            migrationBuilder.InsertData(
                table: "asset_types",
                columns: new[] { "id", "category", "default_volatility", "growth_class", "is_cgt_exempt", "is_super", "is_system", "liquidity", "name", "sort_order" },
                values: new object[] { new Guid("a0000000-0000-0000-0000-000000000007"), "investable", 0.5, "growth", false, false, true, "immediate", "Cryptocurrency", 8 });

            migrationBuilder.InsertData(
                table: "asset_types",
                columns: new[] { "id", "category", "default_return_rate", "default_volatility", "growth_class", "is_cgt_exempt", "is_super", "is_system", "liquidity", "name", "sort_order" },
                values: new object[,]
                {
                    { new Guid("a0000000-0000-0000-0000-000000000008"), "retirement", 0.070000000000000007, 0.12, "mixed", false, true, true, "restricted", "Superannuation — Accumulation", 10 },
                    { new Guid("a0000000-0000-0000-0000-000000000009"), "retirement", 0.059999999999999998, 0.10000000000000001, "mixed", false, true, true, "long_term", "Superannuation — Pension phase", 11 },
                    { new Guid("a0000000-0000-0000-0000-00000000000a"), "property", 0.050000000000000003, 0.10000000000000001, "growth", true, false, true, "long_term", "Primary residence (PPOR)", 12 },
                    { new Guid("a0000000-0000-0000-0000-00000000000b"), "property", 0.050000000000000003, 0.10000000000000001, "growth", false, false, true, "long_term", "Investment property", 13 },
                    { new Guid("a0000000-0000-0000-0000-00000000000c"), "other", -0.10000000000000001, 0.050000000000000003, "defensive", false, false, true, "long_term", "Vehicle", 14 }
                });

            migrationBuilder.InsertData(
                table: "asset_types",
                columns: new[] { "id", "category", "default_volatility", "growth_class", "is_cgt_exempt", "is_super", "is_system", "liquidity", "name", "sort_order" },
                values: new object[] { new Guid("a0000000-0000-0000-0000-00000000000d"), "other", 0.10000000000000001, "mixed", false, false, true, "long_term", "Other physical asset", 15 });

            migrationBuilder.InsertData(
                table: "asset_types",
                columns: new[] { "id", "category", "default_return_rate", "default_volatility", "growth_class", "is_cgt_exempt", "is_super", "is_system", "liquidity", "name", "sort_order" },
                values: new object[,]
                {
                    { new Guid("a0000000-0000-0000-0000-00000000000e"), "investable", 0.050000000000000003, 0.080000000000000002, "growth", false, false, true, "short_term", "Investment bond", 9 },
                    { new Guid("a0000000-0000-0000-0000-00000000000f"), "investable", 0.059999999999999998, 0.12, "growth", false, false, true, "short_term", "Managed fund", 6 }
                });

            migrationBuilder.InsertData(
                table: "liability_types",
                columns: new[] { "id", "category", "debt_quality", "is_hecs", "is_system", "name", "sort_order" },
                values: new object[,]
                {
                    { new Guid("b0000000-0000-0000-0000-000000000001"), "mortgage", "neutral", false, true, "Home loan — PPOR", 1 },
                    { new Guid("b0000000-0000-0000-0000-000000000002"), "mortgage", "productive", false, true, "Home loan — Investment property", 2 },
                    { new Guid("b0000000-0000-0000-0000-000000000003"), "personal", "bad", false, true, "Personal loan", 3 },
                    { new Guid("b0000000-0000-0000-0000-000000000004"), "personal", "bad", false, true, "Car loan", 4 },
                    { new Guid("b0000000-0000-0000-0000-000000000005"), "credit", "bad", false, true, "Credit card", 5 },
                    { new Guid("b0000000-0000-0000-0000-000000000006"), "student", "neutral", true, true, "HECS / HELP debt", 6 },
                    { new Guid("b0000000-0000-0000-0000-000000000007"), "personal", "productive", false, true, "Margin loan", 7 },
                    { new Guid("b0000000-0000-0000-0000-000000000008"), "tax", "neutral", false, true, "Tax liability", 8 },
                    { new Guid("b0000000-0000-0000-0000-000000000009"), "other", "neutral", false, true, "Other liability", 9 }
                });

            migrationBuilder.CreateIndex(
                name: "IX_assets_asset_type_id",
                table: "assets",
                column: "asset_type_id");

            migrationBuilder.CreateIndex(
                name: "IX_assets_household_id_is_active",
                table: "assets",
                columns: new[] { "household_id", "is_active" });

            migrationBuilder.CreateIndex(
                name: "IX_assets_owner_member_id",
                table: "assets",
                column: "owner_member_id");

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
                name: "IX_household_members_household_id",
                table: "household_members",
                column: "household_id");

            migrationBuilder.CreateIndex(
                name: "IX_income_streams_household_id_is_active",
                table: "income_streams",
                columns: new[] { "household_id", "is_active" });

            migrationBuilder.CreateIndex(
                name: "IX_income_streams_owner_member_id",
                table: "income_streams",
                column: "owner_member_id");

            migrationBuilder.CreateIndex(
                name: "IX_liabilities_household_id_is_active",
                table: "liabilities",
                columns: new[] { "household_id", "is_active" });

            migrationBuilder.CreateIndex(
                name: "IX_liabilities_liability_type_id",
                table: "liabilities",
                column: "liability_type_id");

            migrationBuilder.CreateIndex(
                name: "IX_liabilities_owner_member_id",
                table: "liabilities",
                column: "owner_member_id");

            migrationBuilder.CreateIndex(
                name: "IX_snapshots_entity_id_period",
                table: "snapshots",
                columns: new[] { "entity_id", "period" });

            migrationBuilder.CreateIndex(
                name: "IX_snapshots_household_id_period",
                table: "snapshots",
                columns: new[] { "household_id", "period" });

            migrationBuilder.CreateIndex(
                name: "IX_snapshots_recorded_by",
                table: "snapshots",
                column: "recorded_by");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "app_settings");

            migrationBuilder.DropTable(
                name: "assets");

            migrationBuilder.DropTable(
                name: "expenses");

            migrationBuilder.DropTable(
                name: "income_streams");

            migrationBuilder.DropTable(
                name: "liabilities");

            migrationBuilder.DropTable(
                name: "snapshots");

            migrationBuilder.DropTable(
                name: "asset_types");

            migrationBuilder.DropTable(
                name: "expense_categories");

            migrationBuilder.DropTable(
                name: "liability_types");

            migrationBuilder.DropTable(
                name: "household_members");

            migrationBuilder.DropTable(
                name: "households");
        }
    }
}
