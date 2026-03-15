using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Clearfolio.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddAssetSymbol : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "symbol",
                table: "assets",
                type: "TEXT",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "symbol",
                table: "assets");
        }
    }
}
