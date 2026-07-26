CREATE TABLE `inventory` (
	`user_email` text NOT NULL,
	`item_key` text NOT NULL,
	`quantity` integer DEFAULT 1 NOT NULL,
	`acquired_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	PRIMARY KEY(`user_email`, `item_key`),
	FOREIGN KEY (`user_email`) REFERENCES `users`(`email`) ON UPDATE no action ON DELETE cascade
);
