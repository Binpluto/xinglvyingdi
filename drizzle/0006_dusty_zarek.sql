ALTER TABLE `quests` ADD `completed_at` text;
--> statement-breakpoint
UPDATE `quests` SET `completed_at` = `created_at` WHERE `completed` = 1 AND `completed_at` IS NULL;
