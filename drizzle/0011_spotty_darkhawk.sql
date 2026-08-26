ALTER TABLE `focus_sessions` ADD `completed_date` text;--> statement-breakpoint
CREATE INDEX `focus_sessions_daily_idx` ON `focus_sessions` (`user_email`,`completed_date`);