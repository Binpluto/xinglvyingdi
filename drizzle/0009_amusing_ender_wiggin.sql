CREATE TABLE `calendar_checkout_orders` (
	`external_id` text PRIMARY KEY NOT NULL,
	`user_email` text NOT NULL,
	`plan` text NOT NULL,
	`expected_currency` text NOT NULL,
	`expected_amount_minor` integer NOT NULL,
	`provider_session_id` text,
	`provider_event_id` text,
	`completed_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_email`) REFERENCES `users`(`email`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `calendar_checkout_orders_user_idx` ON `calendar_checkout_orders` (`user_email`);--> statement-breakpoint
CREATE UNIQUE INDEX `calendar_checkout_orders_event_idx` ON `calendar_checkout_orders` (`provider_event_id`);