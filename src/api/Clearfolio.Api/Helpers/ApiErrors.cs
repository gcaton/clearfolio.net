namespace Clearfolio.Api.Helpers;

public static class ApiErrors
{
    public static IResult BadRequest(string message) =>
        Results.BadRequest(new { errors = new[] { message } });
}
