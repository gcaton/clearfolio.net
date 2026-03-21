namespace Clearfolio.Api.DTOs;

// ExpenseCategory
public record ExpenseCategoryDto(
    Guid Id,
    string Name,
    int SortOrder,
    bool IsDefault,
    string CreatedAt);

public record CreateExpenseCategoryRequest(string Name);

public record UpdateExpenseCategoryRequest(string Name, int SortOrder);

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
    Guid OwnerMemberId,
    string Label,
    string IncomeType,
    double Amount,
    string Frequency,
    bool IsActive,
    string? Notes);

public record UpdateIncomeStreamRequest(
    Guid OwnerMemberId,
    string Label,
    string IncomeType,
    double Amount,
    string Frequency,
    bool IsActive,
    string? Notes);

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
    Guid ExpenseCategoryId,
    string Label,
    double Amount,
    string Frequency,
    bool IsActive,
    string? Notes);

public record UpdateExpenseRequest(
    Guid? OwnerMemberId,
    Guid ExpenseCategoryId,
    string Label,
    double Amount,
    string Frequency,
    bool IsActive,
    string? Notes);

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
