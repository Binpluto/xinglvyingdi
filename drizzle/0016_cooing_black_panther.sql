CREATE TABLE `monthly_goals` (
	`user_email` text NOT NULL,
	`month_key` text NOT NULL,
	`primary_goal` text NOT NULL,
	`task_goal_count` integer DEFAULT 20 NOT NULL,
	`focus_goal_minutes` integer DEFAULT 600 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	PRIMARY KEY(`user_email`, `month_key`),
	FOREIGN KEY (`user_email`) REFERENCES `users`(`email`) ON UPDATE no action ON DELETE cascade
);
