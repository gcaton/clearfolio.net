using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Clearfolio.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddIsPreTaxContribution : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "is_pre_tax_contribution",
                table: "assets",
                type: "INTEGER",
                nullable: false,
                defaultValue: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "is_pre_tax_contribution",
                table: "assets");
        }
    }
}
