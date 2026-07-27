CREATE TABLE `google_calendar_connections` (
	`user_email` text PRIMARY KEY NOT NULL,
	`refresh_token` text NOT NULL,
	`google_email` text,
	`sync_token` text,
	`last_synced_at` text,
	`connected_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_email`) REFERENCES `users`(`email`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `google_oauth_states` (
	`state` text PRIMARY KEY NOT NULL,
	`user_email` text NOT NULL,
	`expires_at` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_email`) REFERENCES `users`(`email`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `google_oauth_states_expiry_idx` ON `google_oauth_states` (`expires_at`);