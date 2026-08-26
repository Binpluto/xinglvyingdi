CREATE TABLE `daily_departures` (
	`user_email` text NOT NULL,
	`departure_date` text NOT NULL,
	`main_goal` text NOT NULL,
	`focus_goal_minutes` integer DEFAULT 25 NOT NULL,
	`energy_level` text DEFAULT 'medium' NOT NULL,
	`started_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	PRIMARY KEY(`user_email`, `departure_date`),
	FOREIGN KEY (`user_email`) REFERENCES `users`(`email`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `daily_departures_activity_idx` ON `daily_departures` (`user_email`,`departure_date`);--> statement-breakpoint
CREATE TABLE `habit_rest_days` (
	`user_email` text NOT NULL,
	`rest_date` text NOT NULL,
	`month_key` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	PRIMARY KEY(`user_email`, `rest_date`),
	FOREIGN KEY (`user_email`) REFERENCES `users`(`email`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `habit_rest_days_month_idx` ON `habit_rest_days` (`user_email`,`month_key`);--> statement-breakpoint
CREATE TABLE `habit_rewards` (
	`user_email` text NOT NULL,
	`milestone` integer NOT NULL,
	`claimed_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	PRIMARY KEY(`user_email`, `milestone`),
	FOREIGN KEY (`user_email`) REFERENCES `users`(`email`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `habit_settings` (
	`user_email` text PRIMARY KEY NOT NULL,
	`departure_reminder` text DEFAULT '08:30',
	`main_reminder` text DEFAULT '17:30',
	`review_reminder` text DEFAULT '21:30',
	`notifications_enabled` integer DEFAULT false NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_email`) REFERENCES `users`(`email`) ON UPDATE no action ON DELETE cascade
);
