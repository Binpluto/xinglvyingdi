CREATE TABLE `friend_invitations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`inviter_email` text NOT NULL,
	`invitee_email` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`responded_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`inviter_email`) REFERENCES `users`(`email`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`invitee_email`) REFERENCES `users`(`email`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `friend_invitations_pair_idx` ON `friend_invitations` (`inviter_email`,`invitee_email`);--> statement-breakpoint
CREATE INDEX `friend_invitations_invitee_status_idx` ON `friend_invitations` (`invitee_email`,`status`);--> statement-breakpoint
CREATE TABLE `site_notifications` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_email` text NOT NULL,
	`kind` text NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`entity_id` integer,
	`read_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_email`) REFERENCES `users`(`email`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `site_notifications_user_read_idx` ON `site_notifications` (`user_email`,`read_at`,`created_at`);--> statement-breakpoint
CREATE TABLE `team_join_request_votes` (
	`request_id` integer NOT NULL,
	`voter_email` text NOT NULL,
	`decision` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	PRIMARY KEY(`request_id`, `voter_email`),
	FOREIGN KEY (`request_id`) REFERENCES `team_join_requests`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`voter_email`) REFERENCES `users`(`email`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `team_join_requests` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`team_id` integer NOT NULL,
	`applicant_email` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`responded_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`applicant_email`) REFERENCES `users`(`email`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `team_join_requests_team_applicant_idx` ON `team_join_requests` (`team_id`,`applicant_email`);--> statement-breakpoint
CREATE INDEX `team_join_requests_applicant_status_idx` ON `team_join_requests` (`applicant_email`,`status`);--> statement-breakpoint
CREATE INDEX `team_join_requests_team_status_idx` ON `team_join_requests` (`team_id`,`status`);--> statement-breakpoint
ALTER TABLE `users` ADD `avatar_key` text DEFAULT 'initial' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `custom_avatar` text;