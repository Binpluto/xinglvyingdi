CREATE TABLE `calendar_entitlements` (
	`user_email` text PRIMARY KEY NOT NULL,
	`trial_started_at` text,
	`access_until` text,
	`source` text,
	`level_reward_claimed_at` text,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_email`) REFERENCES `users`(`email`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `calendar_entitlements_expiry_idx` ON `calendar_entitlements` (`access_until`);--> statement-breakpoint
CREATE TABLE `calendar_payments` (
	`stripe_event_id` text PRIMARY KEY NOT NULL,
	`user_email` text NOT NULL,
	`plan` text NOT NULL,
	`amount_cny_fen` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_email`) REFERENCES `users`(`email`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `calendar_payments_user_idx` ON `calendar_payments` (`user_email`);