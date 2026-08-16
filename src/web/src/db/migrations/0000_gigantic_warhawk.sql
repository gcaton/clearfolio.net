CREATE TABLE `app_settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `asset_types` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`category` text NOT NULL,
	`liquidity` text NOT NULL,
	`growth_class` text NOT NULL,
	`is_super` integer DEFAULT false NOT NULL,
	`is_cgt_exempt` integer DEFAULT false NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`is_system` integer DEFAULT false NOT NULL,
	`default_return_rate` real DEFAULT 0 NOT NULL,
	`default_volatility` real DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `assets` (
	`id` text PRIMARY KEY NOT NULL,
	`household_id` text NOT NULL,
	`asset_type_id` text NOT NULL,
	`label` text NOT NULL,
	`symbol` text,
	`notes` text,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`contribution_amount_cents` integer,
	`contribution_frequency` text,
	`contribution_end_date` text,
	`is_pre_tax_contribution` integer DEFAULT false NOT NULL,
	`expected_return_rate` real,
	`expected_volatility` real,
	FOREIGN KEY (`household_id`) REFERENCES `households`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`asset_type_id`) REFERENCES `asset_types`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "chk_assets_contribution_amount_cents_int" CHECK("assets"."contribution_amount_cents" IS NULL OR typeof("assets"."contribution_amount_cents") = 'integer')
);
--> statement-breakpoint
CREATE INDEX `idx_assets_household_active` ON `assets` (`household_id`,`is_active`);--> statement-breakpoint
CREATE TABLE `expense_categories` (
	`id` text PRIMARY KEY NOT NULL,
	`household_id` text NOT NULL,
	`name` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`is_default` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`household_id`) REFERENCES `households`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_expense_categories_household` ON `expense_categories` (`household_id`);--> statement-breakpoint
CREATE TABLE `expenses` (
	`id` text PRIMARY KEY NOT NULL,
	`household_id` text NOT NULL,
	`owner_member_id` text,
	`expense_category_id` text NOT NULL,
	`label` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`frequency` text NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`notes` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`household_id`) REFERENCES `households`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`owner_member_id`) REFERENCES `household_members`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`expense_category_id`) REFERENCES `expense_categories`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "chk_expenses_amount_cents_int" CHECK(typeof("expenses"."amount_cents") = 'integer')
);
--> statement-breakpoint
CREATE INDEX `idx_expenses_household_active` ON `expenses` (`household_id`,`is_active`);--> statement-breakpoint
CREATE INDEX `idx_expenses_category` ON `expenses` (`expense_category_id`);--> statement-breakpoint
CREATE TABLE `household_members` (
	`id` text PRIMARY KEY NOT NULL,
	`household_id` text NOT NULL,
	`email` text,
	`display_name` text NOT NULL,
	`member_tag` text NOT NULL,
	`is_primary` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`household_id`) REFERENCES `households`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_members_household` ON `household_members` (`household_id`);--> statement-breakpoint
CREATE TABLE `households` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`base_currency` text DEFAULT 'AUD' NOT NULL,
	`preferred_period_type` text DEFAULT 'FY' NOT NULL,
	`locale` text DEFAULT 'en-AU' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `income_streams` (
	`id` text PRIMARY KEY NOT NULL,
	`household_id` text NOT NULL,
	`owner_member_id` text NOT NULL,
	`label` text NOT NULL,
	`income_type` text DEFAULT 'Additional' NOT NULL,
	`amount_cents` integer NOT NULL,
	`frequency` text NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`notes` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`household_id`) REFERENCES `households`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`owner_member_id`) REFERENCES `household_members`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "chk_income_streams_amount_cents_int" CHECK(typeof("income_streams"."amount_cents") = 'integer')
);
--> statement-breakpoint
CREATE INDEX `idx_income_household_active` ON `income_streams` (`household_id`,`is_active`);--> statement-breakpoint
CREATE TABLE `liabilities` (
	`id` text PRIMARY KEY NOT NULL,
	`household_id` text NOT NULL,
	`liability_type_id` text NOT NULL,
	`label` text NOT NULL,
	`notes` text,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`repayment_amount_cents` integer,
	`repayment_frequency` text,
	`repayment_end_date` text,
	`interest_rate` real,
	FOREIGN KEY (`household_id`) REFERENCES `households`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`liability_type_id`) REFERENCES `liability_types`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "chk_liabilities_repayment_amount_cents_int" CHECK("liabilities"."repayment_amount_cents" IS NULL OR typeof("liabilities"."repayment_amount_cents") = 'integer')
);
--> statement-breakpoint
CREATE INDEX `idx_liabilities_household_active` ON `liabilities` (`household_id`,`is_active`);--> statement-breakpoint
CREATE TABLE `liability_types` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`category` text NOT NULL,
	`debt_quality` text NOT NULL,
	`is_hecs` integer DEFAULT false NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`is_system` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE `ownership` (
	`id` text PRIMARY KEY NOT NULL,
	`entity_id` text NOT NULL,
	`entity_type` text NOT NULL,
	`member_id` text NOT NULL,
	`share_bp` integer NOT NULL,
	FOREIGN KEY (`member_id`) REFERENCES `household_members`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "chk_ownership_entity_type" CHECK("ownership"."entity_type" IN ('asset', 'liability')),
	CONSTRAINT "chk_ownership_share_bp_range" CHECK("ownership"."share_bp" BETWEEN 0 AND 10000)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_ownership_entity_member` ON `ownership` (`entity_id`,`member_id`);--> statement-breakpoint
CREATE INDEX `idx_ownership_entity` ON `ownership` (`entity_id`);--> statement-breakpoint
CREATE TABLE `scenario_assumptions` (
	`id` text PRIMARY KEY NOT NULL,
	`scenario_id` text NOT NULL,
	`entity_id` text NOT NULL,
	`entity_type` text NOT NULL,
	`return_rate` real,
	`volatility` real,
	`contribution_amount_cents` integer,
	`contribution_frequency` text,
	`contribution_end_date` text,
	`interest_rate` real,
	`repayment_amount_cents` integer,
	`repayment_frequency` text,
	`repayment_end_date` text,
	FOREIGN KEY (`scenario_id`) REFERENCES `scenarios`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "chk_scenario_assumptions_entity_type" CHECK("scenario_assumptions"."entity_type" IN ('asset', 'liability')),
	CONSTRAINT "chk_scenario_assumptions_contribution_amount_cents_int" CHECK("scenario_assumptions"."contribution_amount_cents" IS NULL OR typeof("scenario_assumptions"."contribution_amount_cents") = 'integer'),
	CONSTRAINT "chk_scenario_assumptions_repayment_amount_cents_int" CHECK("scenario_assumptions"."repayment_amount_cents" IS NULL OR typeof("scenario_assumptions"."repayment_amount_cents") = 'integer')
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_assumption_scenario_entity` ON `scenario_assumptions` (`scenario_id`,`entity_id`);--> statement-breakpoint
CREATE TABLE `scenarios` (
	`id` text PRIMARY KEY NOT NULL,
	`household_id` text NOT NULL,
	`name` text NOT NULL,
	`horizon_years` integer DEFAULT 20 NOT NULL,
	`inflation_rate` real DEFAULT 0 NOT NULL,
	`is_baseline` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`household_id`) REFERENCES `households`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_scenarios_household` ON `scenarios` (`household_id`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`token` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_sessions_expires` ON `sessions` (`expires_at`);--> statement-breakpoint
CREATE TABLE `snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`household_id` text NOT NULL,
	`entity_id` text NOT NULL,
	`entity_type` text NOT NULL,
	`period` text NOT NULL,
	`value_cents` integer NOT NULL,
	`units` real,
	`price_per_unit` real,
	`notes` text,
	`recorded_by` text NOT NULL,
	`recorded_at` integer NOT NULL,
	FOREIGN KEY (`household_id`) REFERENCES `households`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`recorded_by`) REFERENCES `household_members`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "chk_snapshots_entity_type" CHECK("snapshots"."entity_type" IN ('asset', 'liability')),
	CONSTRAINT "chk_snapshots_value_cents_int" CHECK(typeof("snapshots"."value_cents") = 'integer')
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_snapshots_entity_period` ON `snapshots` (`entity_id`,`period`);--> statement-breakpoint
CREATE INDEX `idx_snapshots_household_period` ON `snapshots` (`household_id`,`period`);