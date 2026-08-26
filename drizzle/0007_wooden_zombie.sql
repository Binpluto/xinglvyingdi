CREATE TABLE `quest_completions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_email` text NOT NULL,
	`quest_id` integer,
	`quest_title` text NOT NULL,
	`reward` integer NOT NULL,
	`source` text DEFAULT 'manual' NOT NULL,
	`completed_date` text NOT NULL,
	`completed_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_email`) REFERENCES `users`(`email`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `quest_completions_quest_idx` ON `quest_completions` (`user_email`,`quest_id`);--> statement-breakpoint
CREATE INDEX `quest_completions_activity_idx` ON `quest_completions` (`user_email`,`completed_date`);--> statement-breakpoint
INSERT OR IGNORE INTO `quest_completions`
	(`user_email`, `quest_id`, `quest_title`, `reward`, `source`, `completed_date`, `completed_at`)
SELECT
	`user_email`, `id`, `title`, `reward`, `source`,
	substr(COALESCE(`completed_at`, `created_at`), 1, 10),
	COALESCE(`completed_at`, `created_at`)
FROM `quests`
WHERE `completed` = 1;
