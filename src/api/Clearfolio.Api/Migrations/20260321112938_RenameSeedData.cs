using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Clearfolio.Api.Migrations
{
    /// <inheritdoc />
    public partial class RenameSeedData : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.UpdateData(
                table: "liability_types",
                keyColumn: "id",
                keyValue: new Guid("b0000000-0000-0000-0000-000000000006"),
                column: "name",
                value: "Student loan (HECS-HELP)");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.UpdateData(
                table: "liability_types",
                keyColumn: "id",
                keyValue: new Guid("b0000000-0000-0000-0000-000000000006"),
                column: "name",
                value: "HECS / HELP debt");
        }
    }
}
