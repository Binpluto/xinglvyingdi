CREATE TABLE `realm_progress` (
	`user_email` text NOT NULL,
	`realm_id` text NOT NULL,
	`completed_regions` integer DEFAULT 0 NOT NULL,
	`unlocked` integer DEFAULT false NOT NULL,
	`target` integer DEFAULT false NOT NULL,
	`unlocked_at` text,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	PRIMARY KEY(`user_email`, `realm_id`),
	FOREIGN KEY (`user_email`) REFERENCES `users`(`email`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `realm_progress_user_idx` ON `realm_progress` (`user_email`);