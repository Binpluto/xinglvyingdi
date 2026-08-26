CREATE TABLE `premium_free_slots` (
	`slot_number` integer PRIMARY KEY NOT NULL,
	`user_email` text,
	`assigned_at` text,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `premium_free_slots_email_idx` ON `premium_free_slots` (`user_email`);