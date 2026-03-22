using Microsoft.EntityFrameworkCore;
using Clearfolio.Api.Models;

namespace Clearfolio.Api.Data;

public class ClearfolioDbContext(DbContextOptions<ClearfolioDbContext> options) : DbContext(options)
{
    public DbSet<Household> Households => Set<Household>();
    public DbSet<HouseholdMember> HouseholdMembers => Set<HouseholdMember>();
    public DbSet<AssetType> AssetTypes => Set<AssetType>();
    public DbSet<LiabilityType> LiabilityTypes => Set<LiabilityType>();
    public DbSet<Asset> Assets => Set<Asset>();
    public DbSet<Liability> Liabilities => Set<Liability>();
    public DbSet<Snapshot> Snapshots => Set<Snapshot>();
    public DbSet<ExpenseCategory> ExpenseCategories => Set<ExpenseCategory>();
    public DbSet<IncomeStream> IncomeStreams => Set<IncomeStream>();
    public DbSet<Expense> Expenses => Set<Expense>();
    public DbSet<AppSetting> AppSettings { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        // Household
        modelBuilder.Entity<Household>(e =>
        {
            e.ToTable("households");
            e.HasKey(h => h.Id);
            e.Property(h => h.Id).HasColumnName("id");
            e.Property(h => h.Name).HasColumnName("name").IsRequired();
            e.Property(h => h.BaseCurrency).HasColumnName("base_currency").HasDefaultValue("AUD");
            e.Property(h => h.PreferredPeriodType).HasColumnName("preferred_period_type").HasDefaultValue("FY");
            e.Property(h => h.Locale).HasColumnName("locale").HasDefaultValue("en-AU");
            e.Property(h => h.CreatedAt).HasColumnName("created_at").IsRequired();
        });

        // HouseholdMember
        modelBuilder.Entity<HouseholdMember>(e =>
        {
            e.ToTable("household_members");
            e.HasKey(m => m.Id);
            e.Property(m => m.Id).HasColumnName("id");
            e.Property(m => m.HouseholdId).HasColumnName("household_id");
            e.Property(m => m.Email).HasColumnName("email");
            e.Property(m => m.DisplayName).HasColumnName("display_name").IsRequired();
            e.Property(m => m.MemberTag).HasColumnName("member_tag").IsRequired();
            e.Property(m => m.IsPrimary).HasColumnName("is_primary");
            e.Property(m => m.CreatedAt).HasColumnName("created_at").IsRequired();

            e.HasOne(m => m.Household).WithMany(h => h.Members).HasForeignKey(m => m.HouseholdId);
        });

        // AssetType
        modelBuilder.Entity<AssetType>(e =>
        {
            e.ToTable("asset_types");
            e.HasKey(a => a.Id);
            e.Property(a => a.Id).HasColumnName("id");
            e.Property(a => a.Name).HasColumnName("name").IsRequired();
            e.Property(a => a.Category).HasColumnName("category").IsRequired();
            e.Property(a => a.Liquidity).HasColumnName("liquidity").IsRequired();
            e.Property(a => a.GrowthClass).HasColumnName("growth_class").IsRequired();
            e.Property(a => a.IsSuper).HasColumnName("is_super");
            e.Property(a => a.IsCgtExempt).HasColumnName("is_cgt_exempt");
            e.Property(a => a.SortOrder).HasColumnName("sort_order");
            e.Property(a => a.IsSystem).HasColumnName("is_system");
            e.Property(t => t.DefaultReturnRate).HasColumnName("default_return_rate").HasDefaultValue(0.0);
            e.Property(t => t.DefaultVolatility).HasColumnName("default_volatility").HasDefaultValue(0.0);
        });

        // LiabilityType
        modelBuilder.Entity<LiabilityType>(e =>
        {
            e.ToTable("liability_types");
            e.HasKey(l => l.Id);
            e.Property(l => l.Id).HasColumnName("id");
            e.Property(l => l.Name).HasColumnName("name").IsRequired();
            e.Property(l => l.Category).HasColumnName("category").IsRequired();
            e.Property(l => l.DebtQuality).HasColumnName("debt_quality").IsRequired();
            e.Property(l => l.IsHecs).HasColumnName("is_hecs");
            e.Property(l => l.SortOrder).HasColumnName("sort_order");
            e.Property(l => l.IsSystem).HasColumnName("is_system");
        });

        // Asset
        modelBuilder.Entity<Asset>(e =>
        {
            e.ToTable("assets");
            e.HasKey(a => a.Id);
            e.Property(a => a.Id).HasColumnName("id");
            e.Property(a => a.HouseholdId).HasColumnName("household_id");
            e.Property(a => a.AssetTypeId).HasColumnName("asset_type_id");
            e.Property(a => a.OwnerMemberId).HasColumnName("owner_member_id");
            e.Property(a => a.OwnershipType).HasColumnName("ownership_type").HasDefaultValue("sole");
            e.Property(a => a.JointSplit).HasColumnName("joint_split").HasDefaultValue(0.5);
            e.Property(a => a.Label).HasColumnName("label").IsRequired();
            e.Property(a => a.Symbol).HasColumnName("symbol");
            e.Property(a => a.Currency).HasColumnName("currency").HasDefaultValue("AUD");
            e.Property(a => a.Notes).HasColumnName("notes");
            e.Property(a => a.IsActive).HasColumnName("is_active").HasDefaultValue(true);
            e.Property(a => a.CreatedAt).HasColumnName("created_at").IsRequired();
            e.Property(a => a.UpdatedAt).HasColumnName("updated_at").IsRequired();
            e.Property(a => a.ContributionAmount).HasColumnName("contribution_amount");
            e.Property(a => a.ContributionFrequency).HasColumnName("contribution_frequency");
            e.Property(a => a.ContributionEndDate).HasColumnName("contribution_end_date");
            e.Property(a => a.IsPreTaxContribution).HasColumnName("is_pre_tax_contribution").HasDefaultValue(false);
            e.Property(a => a.ExpectedReturnRate).HasColumnName("expected_return_rate");
            e.Property(a => a.ExpectedVolatility).HasColumnName("expected_volatility");

            e.HasIndex(a => new { a.HouseholdId, a.IsActive });
            e.HasOne(a => a.Household).WithMany(h => h.Assets).HasForeignKey(a => a.HouseholdId);
            e.HasOne(a => a.AssetType).WithMany(at => at.Assets).HasForeignKey(a => a.AssetTypeId);
            e.HasOne(a => a.OwnerMember).WithMany().HasForeignKey(a => a.OwnerMemberId);
        });

        // Liability
        modelBuilder.Entity<Liability>(e =>
        {
            e.ToTable("liabilities");
            e.HasKey(l => l.Id);
            e.Property(l => l.Id).HasColumnName("id");
            e.Property(l => l.HouseholdId).HasColumnName("household_id");
            e.Property(l => l.LiabilityTypeId).HasColumnName("liability_type_id");
            e.Property(l => l.OwnerMemberId).HasColumnName("owner_member_id");
            e.Property(l => l.OwnershipType).HasColumnName("ownership_type").HasDefaultValue("sole");
            e.Property(l => l.JointSplit).HasColumnName("joint_split").HasDefaultValue(0.5);
            e.Property(l => l.Label).HasColumnName("label").IsRequired();
            e.Property(l => l.Currency).HasColumnName("currency").HasDefaultValue("AUD");
            e.Property(l => l.Notes).HasColumnName("notes");
            e.Property(l => l.IsActive).HasColumnName("is_active").HasDefaultValue(true);
            e.Property(l => l.CreatedAt).HasColumnName("created_at").IsRequired();
            e.Property(l => l.UpdatedAt).HasColumnName("updated_at").IsRequired();
            e.Property(l => l.RepaymentAmount).HasColumnName("repayment_amount");
            e.Property(l => l.RepaymentFrequency).HasColumnName("repayment_frequency");
            e.Property(l => l.RepaymentEndDate).HasColumnName("repayment_end_date");
            e.Property(l => l.InterestRate).HasColumnName("interest_rate");

            e.HasIndex(l => new { l.HouseholdId, l.IsActive });
            e.HasOne(l => l.Household).WithMany(h => h.Liabilities).HasForeignKey(l => l.HouseholdId);
            e.HasOne(l => l.LiabilityType).WithMany(lt => lt.Liabilities).HasForeignKey(l => l.LiabilityTypeId);
            e.HasOne(l => l.OwnerMember).WithMany().HasForeignKey(l => l.OwnerMemberId);
        });

        // Snapshot
        modelBuilder.Entity<Snapshot>(e =>
        {
            e.ToTable("snapshots");
            e.HasKey(s => s.Id);
            e.Property(s => s.Id).HasColumnName("id");
            e.Property(s => s.HouseholdId).HasColumnName("household_id");
            e.Property(s => s.EntityId).HasColumnName("entity_id");
            e.Property(s => s.EntityType).HasColumnName("entity_type").IsRequired();
            e.Property(s => s.Period).HasColumnName("period").IsRequired();
            e.Property(s => s.Value).HasColumnName("value");
            e.Property(s => s.Currency).HasColumnName("currency").HasDefaultValue("AUD");
            e.Property(s => s.Notes).HasColumnName("notes");
            e.Property(s => s.RecordedBy).HasColumnName("recorded_by");
            e.Property(s => s.RecordedAt).HasColumnName("recorded_at").IsRequired();

            e.HasIndex(s => new { s.HouseholdId, s.Period });
            e.HasIndex(s => new { s.EntityId, s.Period });
            e.HasOne(s => s.Household).WithMany(h => h.Snapshots).HasForeignKey(s => s.HouseholdId);
            e.HasOne(s => s.RecordedByMember).WithMany().HasForeignKey(s => s.RecordedBy);
        });

        // ExpenseCategory
        modelBuilder.Entity<ExpenseCategory>(e =>
        {
            e.ToTable("expense_categories");
            e.HasKey(c => c.Id);
            e.Property(c => c.Id).HasColumnName("id");
            e.Property(c => c.HouseholdId).HasColumnName("household_id");
            e.Property(c => c.Name).HasColumnName("name").IsRequired().HasMaxLength(100);
            e.Property(c => c.SortOrder).HasColumnName("sort_order");
            e.Property(c => c.IsDefault).HasColumnName("is_default");
            e.Property(c => c.CreatedAt).HasColumnName("created_at").IsRequired();

            e.HasIndex(c => c.HouseholdId);
            e.HasOne(c => c.Household).WithMany(h => h.ExpenseCategories).HasForeignKey(c => c.HouseholdId);
        });

        // IncomeStream
        modelBuilder.Entity<IncomeStream>(e =>
        {
            e.ToTable("income_streams");
            e.HasKey(i => i.Id);
            e.Property(i => i.Id).HasColumnName("id");
            e.Property(i => i.HouseholdId).HasColumnName("household_id");
            e.Property(i => i.OwnerMemberId).HasColumnName("owner_member_id");
            e.Property(i => i.Label).HasColumnName("label").IsRequired().HasMaxLength(200);
            e.Property(i => i.IncomeType).HasColumnName("income_type").IsRequired();
            e.Property(i => i.Amount).HasColumnName("amount");
            e.Property(i => i.Frequency).HasColumnName("frequency").IsRequired();
            e.Property(i => i.IsActive).HasColumnName("is_active").HasDefaultValue(true);
            e.Property(i => i.Notes).HasColumnName("notes").HasMaxLength(1000);
            e.Property(i => i.CreatedAt).HasColumnName("created_at").IsRequired();
            e.Property(i => i.UpdatedAt).HasColumnName("updated_at").IsRequired();

            e.HasIndex(i => new { i.HouseholdId, i.IsActive });
            e.HasOne(i => i.Household).WithMany(h => h.IncomeStreams).HasForeignKey(i => i.HouseholdId);
            e.HasOne(i => i.OwnerMember).WithMany().HasForeignKey(i => i.OwnerMemberId);
        });

        // Expense
        modelBuilder.Entity<Expense>(e =>
        {
            e.ToTable("expenses");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.HouseholdId).HasColumnName("household_id");
            e.Property(x => x.OwnerMemberId).HasColumnName("owner_member_id");
            e.Property(x => x.ExpenseCategoryId).HasColumnName("expense_category_id");
            e.Property(x => x.Label).HasColumnName("label").IsRequired().HasMaxLength(200);
            e.Property(x => x.Amount).HasColumnName("amount");
            e.Property(x => x.Frequency).HasColumnName("frequency").IsRequired();
            e.Property(x => x.IsActive).HasColumnName("is_active").HasDefaultValue(true);
            e.Property(x => x.Notes).HasColumnName("notes").HasMaxLength(1000);
            e.Property(x => x.CreatedAt).HasColumnName("created_at").IsRequired();
            e.Property(x => x.UpdatedAt).HasColumnName("updated_at").IsRequired();

            e.HasIndex(x => new { x.HouseholdId, x.IsActive });
            e.HasIndex(x => x.ExpenseCategoryId);
            e.HasOne(x => x.Household).WithMany(h => h.Expenses).HasForeignKey(x => x.HouseholdId);
            e.HasOne(x => x.OwnerMember).WithMany().HasForeignKey(x => x.OwnerMemberId);
            e.HasOne(x => x.ExpenseCategory).WithMany().HasForeignKey(x => x.ExpenseCategoryId);
        });

        // AppSetting
        modelBuilder.Entity<AppSetting>(entity =>
        {
            entity.ToTable("app_settings");
            entity.HasKey(e => e.Key);
            entity.Property(e => e.Key).HasColumnName("key");
            entity.Property(e => e.Value).HasColumnName("value");
        });

        SeedData(modelBuilder);
    }

    private static void SeedData(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<AssetType>().HasData(
            new AssetType { Id = Guid.Parse("a0000000-0000-0000-0000-000000000001"), Name = "Cash — savings / transaction", Category = "cash", Liquidity = "immediate", GrowthClass = "defensive", SortOrder = 1, IsSystem = true, DefaultReturnRate = 0.04, DefaultVolatility = 0.01 },
            new AssetType { Id = Guid.Parse("a0000000-0000-0000-0000-000000000002"), Name = "Cash — term deposit (≤90 days)", Category = "cash", Liquidity = "short_term", GrowthClass = "defensive", SortOrder = 2, IsSystem = true, DefaultReturnRate = 0.04, DefaultVolatility = 0.01 },
            new AssetType { Id = Guid.Parse("a0000000-0000-0000-0000-000000000003"), Name = "Term deposit (>90 days)", Category = "cash", Liquidity = "long_term", GrowthClass = "defensive", SortOrder = 3, IsSystem = true, DefaultReturnRate = 0.045, DefaultVolatility = 0.01 },
            new AssetType { Id = Guid.Parse("a0000000-0000-0000-0000-000000000004"), Name = "Australian shares / ETFs", Category = "investable", Liquidity = "short_term", GrowthClass = "growth", SortOrder = 4, IsSystem = true, DefaultReturnRate = 0.07, DefaultVolatility = 0.15 },
            new AssetType { Id = Guid.Parse("a0000000-0000-0000-0000-000000000005"), Name = "International shares / ETFs", Category = "investable", Liquidity = "short_term", GrowthClass = "growth", SortOrder = 5, IsSystem = true, DefaultReturnRate = 0.08, DefaultVolatility = 0.17 },
            new AssetType { Id = Guid.Parse("a0000000-0000-0000-0000-00000000000f"), Name = "Managed fund", Category = "investable", Liquidity = "short_term", GrowthClass = "growth", SortOrder = 6, IsSystem = true, DefaultReturnRate = 0.06, DefaultVolatility = 0.12 },
            new AssetType { Id = Guid.Parse("a0000000-0000-0000-0000-000000000006"), Name = "Bonds / fixed income", Category = "investable", Liquidity = "short_term", GrowthClass = "defensive", SortOrder = 7, IsSystem = true, DefaultReturnRate = 0.04, DefaultVolatility = 0.05 },
            new AssetType { Id = Guid.Parse("a0000000-0000-0000-0000-000000000007"), Name = "Cryptocurrency", Category = "investable", Liquidity = "immediate", GrowthClass = "growth", SortOrder = 8, IsSystem = true, DefaultReturnRate = 0.0, DefaultVolatility = 0.50 },
            new AssetType { Id = Guid.Parse("a0000000-0000-0000-0000-00000000000e"), Name = "Investment bond", Category = "investable", Liquidity = "long_term", GrowthClass = "growth", SortOrder = 9, IsSystem = true, DefaultReturnRate = 0.05, DefaultVolatility = 0.08 },
            new AssetType { Id = Guid.Parse("a0000000-0000-0000-0000-000000000008"), Name = "Superannuation — Accumulation", Category = "retirement", Liquidity = "restricted", GrowthClass = "mixed", IsSuper = true, SortOrder = 10, IsSystem = true, DefaultReturnRate = 0.07, DefaultVolatility = 0.12 },
            new AssetType { Id = Guid.Parse("a0000000-0000-0000-0000-000000000009"), Name = "Superannuation — Pension phase", Category = "retirement", Liquidity = "long_term", GrowthClass = "mixed", IsSuper = true, SortOrder = 11, IsSystem = true, DefaultReturnRate = 0.06, DefaultVolatility = 0.10 },
            new AssetType { Id = Guid.Parse("a0000000-0000-0000-0000-00000000000a"), Name = "Primary residence (PPOR)", Category = "property", Liquidity = "long_term", GrowthClass = "growth", IsCgtExempt = true, SortOrder = 12, IsSystem = true, DefaultReturnRate = 0.05, DefaultVolatility = 0.10 },
            new AssetType { Id = Guid.Parse("a0000000-0000-0000-0000-00000000000b"), Name = "Investment property", Category = "property", Liquidity = "long_term", GrowthClass = "growth", SortOrder = 13, IsSystem = true, DefaultReturnRate = 0.05, DefaultVolatility = 0.10 },
            new AssetType { Id = Guid.Parse("a0000000-0000-0000-0000-00000000000c"), Name = "Vehicle", Category = "other", Liquidity = "long_term", GrowthClass = "defensive", SortOrder = 14, IsSystem = true, DefaultReturnRate = -0.10, DefaultVolatility = 0.05 },
            new AssetType { Id = Guid.Parse("a0000000-0000-0000-0000-00000000000d"), Name = "Other physical asset", Category = "other", Liquidity = "long_term", GrowthClass = "mixed", SortOrder = 15, IsSystem = true, DefaultReturnRate = 0.0, DefaultVolatility = 0.10 }
        );

        modelBuilder.Entity<LiabilityType>().HasData(
            new LiabilityType { Id = Guid.Parse("b0000000-0000-0000-0000-000000000001"), Name = "Home loan — PPOR", Category = "mortgage", DebtQuality = "neutral", SortOrder = 1, IsSystem = true },
            new LiabilityType { Id = Guid.Parse("b0000000-0000-0000-0000-000000000002"), Name = "Home loan — Investment property", Category = "mortgage", DebtQuality = "productive", SortOrder = 2, IsSystem = true },
            new LiabilityType { Id = Guid.Parse("b0000000-0000-0000-0000-000000000003"), Name = "Personal loan", Category = "personal", DebtQuality = "bad", SortOrder = 3, IsSystem = true },
            new LiabilityType { Id = Guid.Parse("b0000000-0000-0000-0000-000000000004"), Name = "Car loan", Category = "personal", DebtQuality = "bad", SortOrder = 4, IsSystem = true },
            new LiabilityType { Id = Guid.Parse("b0000000-0000-0000-0000-000000000005"), Name = "Credit card", Category = "credit", DebtQuality = "bad", SortOrder = 5, IsSystem = true },
            new LiabilityType { Id = Guid.Parse("b0000000-0000-0000-0000-000000000006"), Name = "Student loan (HECS-HELP)", Category = "student", DebtQuality = "neutral", IsHecs = true, SortOrder = 6, IsSystem = true },
            new LiabilityType { Id = Guid.Parse("b0000000-0000-0000-0000-000000000007"), Name = "Margin loan", Category = "personal", DebtQuality = "productive", SortOrder = 7, IsSystem = true },
            new LiabilityType { Id = Guid.Parse("b0000000-0000-0000-0000-000000000008"), Name = "Tax liability", Category = "tax", DebtQuality = "neutral", SortOrder = 8, IsSystem = true },
            new LiabilityType { Id = Guid.Parse("b0000000-0000-0000-0000-000000000009"), Name = "Other liability", Category = "other", DebtQuality = "neutral", SortOrder = 9, IsSystem = true }
        );
    }
}
