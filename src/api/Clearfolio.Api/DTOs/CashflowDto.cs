using System.ComponentModel.DataAnnotations;

namespace Clearfolio.Api.DTOs;

// ExpenseCategory
public record ExpenseCategoryDto(
    Guid Id,
    string Name,
    int SortOrder,
    bool IsDefault,
    string CreatedAt);

public record CreateExpenseCategoryRequest(
    [Required, StringLength(100)] string Name);

public record UpdateExpenseCategoryRequest(
    [Required, StringLength(100)] string Name,
    [Range(0, 1000)] int SortOrder);

// IncomeStream
public record IncomeStreamDto(
    Guid Id,
    Guid OwnerMemberId,
    string? OwnerDisplayName,
    string Label,
    string IncomeType,
    double Amount,
    string Frequency,
    bool IsActive,
    string? Notes,
    string CreatedAt,
    string UpdatedAt);

public record CreateIncomeStreamRequest(
    [Required] Guid OwnerMemberId,
    [Required, StringLength(200)] string Label,
    [Required, StringLength(20)] string IncomeType,
    [Range(0, 1_000_000_000)] double Amount,
    [Required, StringLength(20)] string Frequency,
    bool IsActive,
    [StringLength(500)] string? Notes);

public record UpdateIncomeStreamRequest(
    [Required] Guid OwnerMemberId,
    [Required, StringLength(200)] string Label,
    [Required, StringLength(20)] string IncomeType,
    [Range(0, 1_000_000_000)] double Amount,
    [Required, StringLength(20)] string Frequency,
    bool IsActive,
    [StringLength(500)] string? Notes);

// Expense
public record ExpenseDto(
    Guid Id,
    Guid? OwnerMemberId,
    string? OwnerDisplayName,
    Guid ExpenseCategoryId,
    string ExpenseCategoryName,
    string Label,
    double Amount,
    string Frequency,
    bool IsActive,
    string? Notes,
    string CreatedAt,
    string UpdatedAt);

public record CreateExpenseRequest(
    Guid? OwnerMemberId,
    [Required] Guid ExpenseCategoryId,
    [Required, StringLength(200)] string Label,
    [Range(0, 1_000_000_000)] double Amount,
    [Required, StringLength(20)] string Frequency,
    bool IsActive,
    [StringLength(500)] string? Notes);

public record UpdateExpenseRequest(
    Guid? OwnerMemberId,
    [Required] Guid ExpenseCategoryId,
    [Required, StringLength(200)] string Label,
    [Range(0, 1_000_000_000)] double Amount,
    [Required, StringLength(20)] string Frequency,
    bool IsActive,
    [StringLength(500)] string? Notes);

// Cashflow Summary
public record CashflowSummaryDto(
    double TotalAnnualIncome,
    double TotalAnnualExpenses,
    double TotalAnnualContributions,
    double TotalAnnualRepayments,
    double DisposableIncome,
    double NetCashflow,
    double SavingsRate,
    double DebtToIncomeRatio,
    List<IncomeByMemberDto> IncomeByMember,
    List<ExpensesByCategoryDto> ExpensesByCategory);

public record IncomeByMemberDto(string MemberTag, string DisplayName, double AnnualIncome);

public record ExpensesByCategoryDto(string CategoryName, double AnnualAmount);

// Export
public record ExportExpenseCategoryDto(string Name, int SortOrder, bool IsDefault);

public record ExportIncomeStreamDto(
    string? OwnerMemberTag,
    string Label,
    string IncomeType,
    double Amount,
    string Frequency,
    bool IsActive,
    string? Notes);

public record ExportExpenseDto(
    string? OwnerMemberTag,
    string ExpenseCategoryName,
    string Label,
    double Amount,
    string Frequency,
    bool IsActive,
    string? Notes);
