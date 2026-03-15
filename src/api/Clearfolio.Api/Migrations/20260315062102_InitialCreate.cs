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
                    is_system = table.Column<bool>(type: "INTEGER", nullable: false)
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
                name: "household_members",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "TEXT", nullable: false),
                    household_id = table.Column<Guid>(type: "TEXT", nullable: false),
                    email = table.Column<string>(type: "TEXT", nullable: false),
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
                    currency = table.Column<string>(type: "TEXT", nullable: false, defaultValue: "AUD"),
                    notes = table.Column<string>(type: "TEXT", nullable: true),
                    is_active = table.Column<bool>(type: "INTEGER", nullable: false, defaultValue: true),
                    created_at = table.Column<string>(type: "TEXT", nullable: false),
                    updated_at = table.Column<string>(type: "TEXT", nullable: false)
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
                    updated_at = table.Column<string>(type: "TEXT", nullable: false)
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
                columns: new[] { "id", "category", "growth_class", "is_cgt_exempt", "is_super", "is_system", "liquidity", "name", "sort_order" },
                values: new object[,]
                {
                    { new Guid("a0000000-0000-0000-0000-000000000001"), "cash", "defensive", false, false, true, "immediate", "Cash — savings / transaction", 1 },
                    { new Guid("a0000000-0000-0000-0000-000000000002"), "cash", "defensive", false, false, true, "short_term", "Cash — term deposit (≤90 days)", 2 },
                    { new Guid("a0000000-0000-0000-0000-000000000003"), "cash", "defensive", false, false, true, "long_term", "Term deposit (>90 days)", 3 },
                    { new Guid("a0000000-0000-0000-0000-000000000004"), "investable", "growth", false, false, true, "short_term", "Australian shares / ETFs", 4 },
                    { new Guid("a0000000-0000-0000-0000-000000000005"), "investable", "growth", false, false, true, "short_term", "International shares / ETFs", 5 },
                    { new Guid("a0000000-0000-0000-0000-000000000006"), "investable", "defensive", false, false, true, "short_term", "Bonds / fixed income", 6 },
                    { new Guid("a0000000-0000-0000-0000-000000000007"), "investable", "growth", false, false, true, "immediate", "Cryptocurrency", 7 },
                    { new Guid("a0000000-0000-0000-0000-000000000008"), "retirement", "mixed", false, true, true, "restricted", "Superannuation — Accumulation", 8 },
                    { new Guid("a0000000-0000-0000-0000-000000000009"), "retirement", "mixed", false, true, true, "long_term", "Superannuation — Pension phase", 9 },
                    { new Guid("a0000000-0000-0000-0000-00000000000a"), "property", "growth", true, false, true, "long_term", "Primary residence (PPOR)", 10 },
                    { new Guid("a0000000-0000-0000-0000-00000000000b"), "property", "growth", false, false, true, "long_term", "Investment property", 11 },
                    { new Guid("a0000000-0000-0000-0000-00000000000c"), "other", "defensive", false, false, true, "long_term", "Vehicle", 12 },
                    { new Guid("a0000000-0000-0000-0000-00000000000d"), "other", "mixed", false, false, true, "long_term", "Other physical asset", 13 }
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
                name: "IX_household_members_email",
                table: "household_members",
                column: "email",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_household_members_household_id",
                table: "household_members",
                column: "household_id");

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
                name: "assets");

            migrationBuilder.DropTable(
                name: "liabilities");

            migrationBuilder.DropTable(
                name: "snapshots");

            migrationBuilder.DropTable(
                name: "asset_types");

            migrationBuilder.DropTable(
                name: "liability_types");

            migrationBuilder.DropTable(
                name: "household_members");

            migrationBuilder.DropTable(
                name: "households");
        }
    }
}
