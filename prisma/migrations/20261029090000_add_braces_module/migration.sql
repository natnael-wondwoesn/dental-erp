-- CreateTable
CREATE TABLE `BracesCase` (
    `id` VARCHAR(191) NOT NULL,
    `hospitalId` VARCHAR(191) NOT NULL,
    `patientId` VARCHAR(191) NOT NULL,
    `chiefComplaint` TEXT NULL,
    `findings` JSON NULL,
    `severity` VARCHAR(191) NULL,
    `clinicalDiagnosis` TEXT NULL,
    `assessmentNotes` TEXT NULL,
    `recordsNotes` TEXT NULL,
    `bracesType` VARCHAR(191) NULL,
    `objectives` TEXT NULL,
    `plannedProcedures` JSON NULL,
    `stages` JSON NULL,
    `estimatedMonths` INTEGER NULL,
    `estimatedCost` DECIMAL(12, 2) NULL,
    `planNotes` TEXT NULL,
    `planStatus` VARCHAR(191) NOT NULL DEFAULT 'DRAFT',
    `removalDate` DATETIME(3) NULL,
    `retainerType` VARCHAR(191) NULL,
    `retainerInstructions` TEXT NULL,
    `retentionFollowUps` JSON NULL,
    `retentionNotes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `BracesCase_hospitalId_idx`(`hospitalId`),
    UNIQUE INDEX `BracesCase_hospitalId_patientId_key`(`hospitalId`, `patientId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BracesVisit` (
    `id` VARCHAR(191) NOT NULL,
    `hospitalId` VARCHAR(191) NOT NULL,
    `bracesCaseId` VARCHAR(191) NOT NULL,
    `visitDate` DATETIME(3) NOT NULL,
    `visitType` VARCHAR(191) NOT NULL,
    `wireAdjustments` TEXT NULL,
    `applianceChanges` TEXT NULL,
    `clinicalProgress` TEXT NULL,
    `patientConcerns` TEXT NULL,
    `nextAppointment` DATETIME(3) NULL,
    `doctorId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `BracesVisit_hospitalId_idx`(`hospitalId`),
    INDEX `BracesVisit_bracesCaseId_visitDate_idx`(`bracesCaseId`, `visitDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `BracesCase` ADD CONSTRAINT `BracesCase_hospitalId_fkey` FOREIGN KEY (`hospitalId`) REFERENCES `Hospital`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BracesCase` ADD CONSTRAINT `BracesCase_patientId_fkey` FOREIGN KEY (`patientId`) REFERENCES `Patient`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BracesVisit` ADD CONSTRAINT `BracesVisit_hospitalId_fkey` FOREIGN KEY (`hospitalId`) REFERENCES `Hospital`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BracesVisit` ADD CONSTRAINT `BracesVisit_bracesCaseId_fkey` FOREIGN KEY (`bracesCaseId`) REFERENCES `BracesCase`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BracesVisit` ADD CONSTRAINT `BracesVisit_doctorId_fkey` FOREIGN KEY (`doctorId`) REFERENCES `Staff`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

