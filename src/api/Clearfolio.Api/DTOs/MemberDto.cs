using System.ComponentModel.DataAnnotations;

namespace Clearfolio.Api.DTOs;

public record MemberDto(
    Guid Id,
    string? Email,
    string DisplayName,
    string MemberTag,
    bool IsPrimary,
    string CreatedAt);

public record UpdateMemberRequest(
    [Required, StringLength(100)] string DisplayName,
    [StringLength(200), EmailAddress] string? Email = null);

public record CreateMemberRequest(
    [StringLength(200), EmailAddress] string? Email,
    [Required, StringLength(100)] string DisplayName);
