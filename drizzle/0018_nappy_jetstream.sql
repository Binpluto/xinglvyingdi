ALTER TABLE `time_blocks` ADD `quest_id` integer REFERENCES quests(id) ON DELETE SET NULL;
