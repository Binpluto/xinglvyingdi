CREATE TABLE `team_invitations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`team_id` integer NOT NULL,
	`inviter_email` text NOT NULL,
	`invitee_email` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`responded_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`inviter_email`) REFERENCES `users`(`email`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `team_invitations_team_email_idx` ON `team_invitations` (`team_id`,`invitee_email`);--> statement-breakpoint
CREATE INDEX `team_invitations_invitee_status_idx` ON `team_invitations` (`invitee_email`,`status`);