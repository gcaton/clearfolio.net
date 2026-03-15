using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Clearfolio.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddManagedFundAssetType : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.UpdateData(
                table: "asset_types",
                keyColumn: "id",
                keyValue: new Guid("a0000000-0000-0000-0000-000000000006"),
                column: "sort_order",
                value: 7);

            migrationBuilder.UpdateData(
                table: "asset_types",
                keyColumn: "id",
                keyValue: new Guid("a0000000-0000-0000-0000-000000000007"),
                column: "sort_order",
                value: 8);

            migrationBuilder.UpdateData(
                table: "asset_types",
                keyColumn: "id",
                keyValue: new Guid("a0000000-0000-0000-0000-000000000008"),
                column: "sort_order",
                value: 10);

            migrationBuilder.UpdateData(
                table: "asset_types",
                keyColumn: "id",
                keyValue: new Guid("a0000000-0000-0000-0000-000000000009"),
                column: "sort_order",
                value: 11);

            migrationBuilder.UpdateData(
                table: "asset_types",
                keyColumn: "id",
                keyValue: new Guid("a0000000-0000-0000-0000-00000000000a"),
                column: "sort_order",
                value: 12);

            migrationBuilder.UpdateData(
                table: "asset_types",
                keyColumn: "id",
                keyValue: new Guid("a0000000-0000-0000-0000-00000000000b"),
                column: "sort_order",
                value: 13);

            migrationBuilder.UpdateData(
                table: "asset_types",
                keyColumn: "id",
                keyValue: new Guid("a0000000-0000-0000-0000-00000000000c"),
                column: "sort_order",
                value: 14);

            migrationBuilder.UpdateData(
                table: "asset_types",
                keyColumn: "id",
                keyValue: new Guid("a0000000-0000-0000-0000-00000000000d"),
                column: "sort_order",
                value: 15);

            migrationBuilder.UpdateData(
                table: "asset_types",
                keyColumn: "id",
                keyValue: new Guid("a0000000-0000-0000-0000-00000000000e"),
                column: "sort_order",
                value: 9);

            migrationBuilder.InsertData(
                table: "asset_types",
                columns: new[] { "id", "category", "growth_class", "is_cgt_exempt", "is_super", "is_system", "liquidity", "name", "sort_order" },
                values: new object[] { new Guid("a0000000-0000-0000-0000-00000000000f"), "investable", "growth", false, false, true, "short_term", "Managed fund", 6 });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DeleteData(
                table: "asset_types",
                keyColumn: "id",
                keyValue: new Guid("a0000000-0000-0000-0000-00000000000f"));

            migrationBuilder.UpdateData(
                table: "asset_types",
                keyColumn: "id",
                keyValue: new Guid("a0000000-0000-0000-0000-000000000006"),
                column: "sort_order",
                value: 6);

            migrationBuilder.UpdateData(
                table: "asset_types",
                keyColumn: "id",
                keyValue: new Guid("a0000000-0000-0000-0000-000000000007"),
                column: "sort_order",
                value: 7);

            migrationBuilder.UpdateData(
                table: "asset_types",
                keyColumn: "id",
                keyValue: new Guid("a0000000-0000-0000-0000-000000000008"),
                column: "sort_order",
                value: 9);

            migrationBuilder.UpdateData(
                table: "asset_types",
                keyColumn: "id",
                keyValue: new Guid("a0000000-0000-0000-0000-000000000009"),
                column: "sort_order",
                value: 10);

            migrationBuilder.UpdateData(
                table: "asset_types",
                keyColumn: "id",
                keyValue: new Guid("a0000000-0000-0000-0000-00000000000a"),
                column: "sort_order",
                value: 11);

            migrationBuilder.UpdateData(
                table: "asset_types",
                keyColumn: "id",
                keyValue: new Guid("a0000000-0000-0000-0000-00000000000b"),
                column: "sort_order",
                value: 12);

            migrationBuilder.UpdateData(
                table: "asset_types",
                keyColumn: "id",
                keyValue: new Guid("a0000000-0000-0000-0000-00000000000c"),
                column: "sort_order",
                value: 13);

            migrationBuilder.UpdateData(
                table: "asset_types",
                keyColumn: "id",
                keyValue: new Guid("a0000000-0000-0000-0000-00000000000d"),
                column: "sort_order",
                value: 14);

            migrationBuilder.UpdateData(
                table: "asset_types",
                keyColumn: "id",
                keyValue: new Guid("a0000000-0000-0000-0000-00000000000e"),
                column: "sort_order",
                value: 8);
        }
    }
}
