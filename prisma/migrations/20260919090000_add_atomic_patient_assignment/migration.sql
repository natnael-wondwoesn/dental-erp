ALTER TABLE `Appointment` ADD COLUMN `assignedAt` DATETIME(3) NULL;

CREATE INDEX `Appointment_assignedAt_idx` ON `Appointment`(`assignedAt`);
