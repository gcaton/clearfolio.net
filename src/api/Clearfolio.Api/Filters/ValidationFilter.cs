using System.ComponentModel.DataAnnotations;

namespace Clearfolio.Api.Filters;

public class ValidationFilter<T> : IEndpointFilter
{
    public async ValueTask<object?> InvokeAsync(EndpointFilterInvocationContext context, EndpointFilterDelegate next)
    {
        var argument = context.Arguments.OfType<T>().FirstOrDefault();
        if (argument is null)
            return Results.BadRequest(new { errors = new[] { "Request body is required." } });

        var results = new List<ValidationResult>();
        if (!Validator.TryValidateObject(argument, new ValidationContext(argument), results, validateAllProperties: true))
        {
            var errors = results.Select(r => r.ErrorMessage).Where(m => !string.IsNullOrEmpty(m)).ToArray();
            return Results.BadRequest(new { errors });
        }

        return await next(context);
    }
}
