CREATE TABLE `time_block_categories` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_email` text NOT NULL,
	`parent_type` text NOT NULL,
	`name` text NOT NULL,
	`color_key` text DEFAULT 'jade' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_email`) REFERENCES `users`(`email`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `time_block_categories_user_type_name_idx` ON `time_block_categories` (`user_email`,`parent_type`,`name`);--> statement-breakpoint
CREATE TABLE `time_blocks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_email` text NOT NULL,
	`block_date` text NOT NULL,
	`start_minute` integer NOT NULL,
	`end_minute` integer NOT NULL,
	`title` text NOT NULL,
	`type` text NOT NULL,
	`category_name` text DEFAULT '未分类' NOT NULL,
	`color_key` text DEFAULT 'jade' NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_email`) REFERENCES `users`(`email`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `time_blocks_user_date_start_idx` ON `time_blocks` (`user_email`,`block_date`,`start_minute`);