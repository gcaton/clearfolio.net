namespace Clearfolio.Api.DTOs;

public record MemberDto(
    Guid Id,
    string Email,
    string DisplayName,
    string MemberTag,
    bool IsPrimary,
    string CreatedAt);

public record UpdateMemberRequest(
    string DisplayName);

public record CreateMemberRequest(
    string Email,
    string DisplayName);
