using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Clearfolio.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddProjectionFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<double>(
                name: "interest_rate",
                table: "liabilities",
                type: "REAL",
                nullable: true);

            migrationBuilder.AddColumn<double>(
                name: "repayment_amount",
                table: "liabilities",
                type: "REAL",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "repayment_end_date",
                table: "liabilities",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "repayment_frequency",
                table: "liabilities",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<double>(
                name: "contribution_amount",
                table: "assets",
                type: "REAL",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "contribution_end_date",
                table: "assets",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "contribution_frequency",
                table: "assets",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<double>(
                name: "expected_return_rate",
                table: "assets",
                type: "REAL",
                nullable: true);

            migrationBuilder.AddColumn<double>(
                name: "expected_volatility",
                table: "assets",
                type: "REAL",
                nullable: true);

            migrationBuilder.AddColumn<double>(
                name: "default_return_rate",
                table: "asset_types",
                type: "REAL",
                nullable: false,
                defaultValue: 0.0);

            migrationBuilder.AddColumn<double>(
                name: "default_volatility",
                table: "asset_types",
                type: "REAL",
                nullable: false,
                defaultValue: 0.0);

            migrationBuilder.Sql(@"
    UPDATE asset_types SET default_return_rate = 0.04, default_volatility = 0.01 WHERE id = 'a0000000-0000-0000-0000-000000000001';
    UPDATE asset_types SET default_return_rate = 0.04, default_volatility = 0.01 WHERE id = 'a0000000-0000-0000-0000-000000000002';
    UPDATE asset_types SET default_return_rate = 0.045, default_volatility = 0.01 WHERE id = 'a0000000-0000-0000-0000-000000000003';
    UPDATE asset_types SET default_return_rate = 0.07, default_volatility = 0.15 WHERE id = 'a0000000-0000-0000-0000-000000000004';
    UPDATE asset_types SET default_return_rate = 0.08, default_volatility = 0.17 WHERE id = 'a0000000-0000-0000-0000-000000000005';
    UPDATE asset_types SET default_return_rate = 0.06, default_volatility = 0.12 WHERE id = 'a0000000-0000-0000-0000-00000000000f';
    UPDATE asset_types SET default_return_rate = 0.04, default_volatility = 0.05 WHERE id = 'a0000000-0000-0000-0000-000000000006';
    UPDATE asset_types SET default_return_rate = 0.0, default_volatility = 0.50 WHERE id = 'a0000000-0000-0000-0000-000000000007';
    UPDATE asset_types SET default_return_rate = 0.05, default_volatility = 0.08 WHERE id = 'a0000000-0000-0000-0000-00000000000e';
    UPDATE asset_types SET default_return_rate = 0.07, default_volatility = 0.12 WHERE id = 'a0000000-0000-0000-0000-000000000008';
    UPDATE asset_types SET default_return_rate = 0.06, default_volatility = 0.10 WHERE id = 'a0000000-0000-0000-0000-000000000009';
    UPDATE asset_types SET default_return_rate = 0.05, default_volatility = 0.10 WHERE id = 'a0000000-0000-0000-0000-00000000000a';
    UPDATE asset_types SET default_return_rate = 0.05, default_volatility = 0.10 WHERE id = 'a0000000-0000-0000-0000-00000000000b';
    UPDATE asset_types SET default_return_rate = -0.10, default_volatility = 0.05 WHERE id = 'a0000000-0000-0000-0000-00000000000c';
    UPDATE asset_types SET default_return_rate = 0.0, default_volatility = 0.10 WHERE id = 'a0000000-0000-0000-0000-00000000000d';
");

            migrationBuilder.UpdateData(
                table: "asset_types",
                keyColumn: "id",
                keyValue: new Guid("a0000000-0000-0000-0000-000000000001"),
                columns: new[] { "default_return_rate", "default_volatility" },
                values: new object[] { 0.040000000000000001, 0.01 });

            migrationBuilder.UpdateData(
                table: "asset_types",
                keyColumn: "id",
                keyValue: new Guid("a0000000-0000-0000-0000-000000000002"),
                columns: new[] { "default_return_rate", "default_volatility" },
                values: new object[] { 0.040000000000000001, 0.01 });

            migrationBuilder.UpdateData(
                table: "asset_types",
                keyColumn: "id",
                keyValue: new Guid("a0000000-0000-0000-0000-000000000003"),
                columns: new[] { "default_return_rate", "default_volatility" },
                values: new object[] { 0.044999999999999998, 0.01 });

            migrationBuilder.UpdateData(
                table: "asset_types",
                keyColumn: "id",
                keyValue: new Guid("a0000000-0000-0000-0000-000000000004"),
                columns: new[] { "default_return_rate", "default_volatility" },
                values: new object[] { 0.070000000000000007, 0.14999999999999999 });

            migrationBuilder.UpdateData(
                table: "asset_types",
                keyColumn: "id",
                keyValue: new Guid("a0000000-0000-0000-0000-000000000005"),
                columns: new[] { "default_return_rate", "default_volatility" },
                values: new object[] { 0.080000000000000002, 0.17000000000000001 });

            migrationBuilder.UpdateData(
                table: "asset_types",
                keyColumn: "id",
                keyValue: new Guid("a0000000-0000-0000-0000-000000000006"),
                columns: new[] { "default_return_rate", "default_volatility" },
                values: new object[] { 0.040000000000000001, 0.050000000000000003 });

            migrationBuilder.UpdateData(
                table: "asset_types",
                keyColumn: "id",
                keyValue: new Guid("a0000000-0000-0000-0000-000000000007"),
                column: "default_volatility",
                value: 0.5);

            migrationBuilder.UpdateData(
                table: "asset_types",
                keyColumn: "id",
                keyValue: new Guid("a0000000-0000-0000-0000-000000000008"),
                columns: new[] { "default_return_rate", "default_volatility" },
                values: new object[] { 0.070000000000000007, 0.12 });

            migrationBuilder.UpdateData(
                table: "asset_types",
                keyColumn: "id",
                keyValue: new Guid("a0000000-0000-0000-0000-000000000009"),
                columns: new[] { "default_return_rate", "default_volatility" },
                values: new object[] { 0.059999999999999998, 0.10000000000000001 });

            migrationBuilder.UpdateData(
                table: "asset_types",
                keyColumn: "id",
                keyValue: new Guid("a0000000-0000-0000-0000-00000000000a"),
                columns: new[] { "default_return_rate", "default_volatility" },
                values: new object[] { 0.050000000000000003, 0.10000000000000001 });

            migrationBuilder.UpdateData(
                table: "asset_types",
                keyColumn: "id",
                keyValue: new Guid("a0000000-0000-0000-0000-00000000000b"),
                columns: new[] { "default_return_rate", "default_volatility" },
                values: new object[] { 0.050000000000000003, 0.10000000000000001 });

            migrationBuilder.UpdateData(
                table: "asset_types",
                keyColumn: "id",
                keyValue: new Guid("a0000000-0000-0000-0000-00000000000c"),
                columns: new[] { "default_return_rate", "default_volatility" },
                values: new object[] { -0.10000000000000001, 0.050000000000000003 });

            migrationBuilder.UpdateData(
                table: "asset_types",
                keyColumn: "id",
                keyValue: new Guid("a0000000-0000-0000-0000-00000000000d"),
                column: "default_volatility",
                value: 0.10000000000000001);

            migrationBuilder.UpdateData(
                table: "asset_types",
                keyColumn: "id",
                keyValue: new Guid("a0000000-0000-0000-0000-00000000000e"),
                columns: new[] { "default_return_rate", "default_volatility" },
                values: new object[] { 0.050000000000000003, 0.080000000000000002 });

            migrationBuilder.UpdateData(
                table: "asset_types",
                keyColumn: "id",
                keyValue: new Guid("a0000000-0000-0000-0000-00000000000f"),
                columns: new[] { "default_return_rate", "default_volatility" },
                values: new object[] { 0.059999999999999998, 0.12 });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "interest_rate",
                table: "liabilities");

            migrationBuilder.DropColumn(
                name: "repayment_amount",
                table: "liabilities");

            migrationBuilder.DropColumn(
                name: "repayment_end_date",
                table: "liabilities");

            migrationBuilder.DropColumn(
                name: "repayment_frequency",
                table: "liabilities");

            migrationBuilder.DropColumn(
                name: "contribution_amount",
                table: "assets");

            migrationBuilder.DropColumn(
                name: "contribution_end_date",
                table: "assets");

            migrationBuilder.DropColumn(
                name: "contribution_frequency",
                table: "assets");

            migrationBuilder.DropColumn(
                name: "expected_return_rate",
                table: "assets");

            migrationBuilder.DropColumn(
                name: "expected_volatility",
                table: "assets");

            migrationBuilder.DropColumn(
                name: "default_return_rate",
                table: "asset_types");

            migrationBuilder.DropColumn(
                name: "default_volatility",
                table: "asset_types");
        }
    }
}
