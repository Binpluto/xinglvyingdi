ALTER TABLE `quests` ADD `source` text DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE `quests` ADD `due_at` text;--> statement-breakpoint
ALTER TABLE `quests` ADD `external_id` text;--> statement-breakpoint
CREATE UNIQUE INDEX `quests_calendar_event_idx` ON `quests` (`user_email`,`source`,`external_id`);