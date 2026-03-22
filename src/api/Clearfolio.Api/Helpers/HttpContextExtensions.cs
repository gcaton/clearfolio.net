using Clearfolio.Api.Models;

namespace Clearfolio.Api.Helpers;

public static class HttpContextExtensions
{
    public static HouseholdMember? GetMemberOrNull(this HttpContext context) =>
        context.Items["HouseholdMember"] as HouseholdMember;
}
