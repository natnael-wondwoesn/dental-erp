CREATE TABLE `PatientRecall` (
  `id` VARCHAR(191) NOT NULL,
  `hospitalId` VARCHAR(191) NOT NULL,
  `patientId` VARCHAR(191) NOT NULL,
  `treatmentId` VARCHAR(191) NULL,
  `createdById` VARCHAR(191) NOT NULL,
  `lastTreatmentDate` DATETIME(3) NOT NULL,
  `followUpDate` DATETIME(3) NOT NULL,
  `reminderDate` DATETIME(3) NOT NULL,
  `reminderLeadDays` INTEGER NOT NULL DEFAULT 7,
  `status` ENUM('SCHEDULED', 'REMINDER_SENT', 'RETURNED', 'CANCELLED') NOT NULL DEFAULT 'SCHEDULED',
  `smsStatus` ENUM('PENDING', 'SENDING', 'SENT', 'FAILED', 'SKIPPED') NOT NULL DEFAULT 'PENDING',
  `smsLogId` VARCHAR(191) NULL,
  `smsSentAt` DATETIME(3) NULL,
  `smsAttempts` INTEGER NOT NULL DEFAULT 0,
  `lastSmsError` TEXT NULL,
  `processingAt` DATETIME(3) NULL,
  `returnedAt` DATETIME(3) NULL,
  `notes` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `PatientRecall_hospitalId_patientId_followUpDate_key`(`hospitalId`, `patientId`, `followUpDate`),
  INDEX `PatientRecall_hospitalId_idx`(`hospitalId`),
  INDEX `PatientRecall_patientId_idx`(`patientId`),
  INDEX `PatientRecall_reminderDate_smsStatus_idx`(`reminderDate`, `smsStatus`),
  INDEX `PatientRecall_status_idx`(`status`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `PatientRecall`
  ADD CONSTRAINT `PatientRecall_hospitalId_fkey`
  FOREIGN KEY (`hospitalId`) REFERENCES `Hospital`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `PatientRecall`
  ADD CONSTRAINT `PatientRecall_patientId_fkey`
  FOREIGN KEY (`patientId`) REFERENCES `Patient`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `PatientRecall`
  ADD CONSTRAINT `PatientRecall_treatmentId_fkey`
  FOREIGN KEY (`treatmentId`) REFERENCES `Treatment`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `PatientRecall`
  ADD CONSTRAINT `PatientRecall_createdById_fkey`
  FOREIGN KEY (`createdById`) REFERENCES `User`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;
