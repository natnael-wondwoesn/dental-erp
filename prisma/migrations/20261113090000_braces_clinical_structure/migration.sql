-- Additive only: new nullable columns and new tables. Nothing existing is changed or dropped.

-- AlterTable
ALTER TABLE `BracesCase`
    ADD COLUMN `treatmentStartDate` DATETIME(3) NULL,
    ADD COLUMN `estimatedCompletionDate` DATETIME(3) NULL,
    ADD COLUMN `customBracesType` VARCHAR(191) NULL,
    ADD COLUMN `procedureList` JSON NULL,
    ADD COLUMN `upperRetainer` VARCHAR(191) NULL,
    ADD COLUMN `lowerRetainer` VARCHAR(191) NULL,
    ADD COLUMN `retainerDeliveryDate` DATETIME(3) NULL,
    ADD COLUMN `retainerWear` VARCHAR(191) NULL,
    ADD COLUMN `retainerCondition` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `BracesVisit`
    ADD COLUMN `status` VARCHAR(191) NULL,
    ADD COLUMN `currentStage` VARCHAR(191) NULL,
    ADD COLUMN `clinicalFindings` TEXT NULL,
    ADD COLUMN `progressSinceLast` TEXT NULL,
    ADD COLUMN `objectivesAchieved` TEXT NULL,
    ADD COLUMN `remainingObjectives` TEXT NULL,
    ADD COLUMN `complications` TEXT NULL,
    ADD COLUMN `modifications` TEXT NULL,
    ADD COLUMN `recommendations` TEXT NULL,
    ADD COLUMN `proceduresPerformed` JSON NULL,
    ADD COLUMN `wires` JSON NULL,
    ADD COLUMN `invoiceId` VARCHAR(191) NULL,
    ADD COLUMN `createdById` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `BracesAssessment` (
    `id` VARCHAR(191) NOT NULL,
    `hospitalId` VARCHAR(191) NOT NULL,
    `bracesCaseId` VARCHAR(191) NOT NULL,
    `assessedAt` DATETIME(3) NOT NULL,
    `doctorId` VARCHAR(191) NULL,
    `createdById` VARCHAR(191) NULL,
    `chiefComplaint` TEXT NULL,
    `clinicalDiagnosis` TEXT NULL,
    `severity` VARCHAR(191) NULL,
    `dentalHistory` TEXT NULL,
    `medicalHistory` TEXT NULL,
    `facialProfile` VARCHAR(191) NULL,
    `skeletalClass` VARCHAR(191) NULL,
    `molarRight` VARCHAR(191) NULL,
    `molarLeft` VARCHAR(191) NULL,
    `canineRight` VARCHAR(191) NULL,
    `canineLeft` VARCHAR(191) NULL,
    `crossbite` JSON NULL,
    `oralHabits` JSON NULL,
    `findings` JSON NULL,
    `overjetMm` DECIMAL(6, 2) NULL,
    `overbiteMm` DECIMAL(6, 2) NULL,
    `overbitePercent` DECIMAL(6, 2) NULL,
    `midlineUpperMm` DECIMAL(6, 2) NULL,
    `midlineLowerMm` DECIMAL(6, 2) NULL,
    `crowdingUpperMm` DECIMAL(6, 2) NULL,
    `crowdingLowerMm` DECIMAL(6, 2) NULL,
    `spacingUpperMm` DECIMAL(6, 2) NULL,
    `spacingLowerMm` DECIMAL(6, 2) NULL,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `BracesAssessment_hospitalId_idx`(`hospitalId`),
    INDEX `BracesAssessment_bracesCaseId_assessedAt_idx`(`bracesCaseId`, `assessedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BracesMedia` (
    `id` VARCHAR(191) NOT NULL,
    `hospitalId` VARCHAR(191) NOT NULL,
    `bracesCaseId` VARCHAR(191) NOT NULL,
    `documentId` VARCHAR(191) NOT NULL,
    `kind` VARCHAR(191) NOT NULL,
    `category` VARCHAR(191) NOT NULL,
    `stage` VARCHAR(191) NULL,
    `capturedAt` DATETIME(3) NOT NULL,
    `interpretation` TEXT NULL,
    `notes` TEXT NULL,
    `uploadedById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `BracesMedia_hospitalId_idx`(`hospitalId`),
    INDEX `BracesMedia_bracesCaseId_kind_capturedAt_idx`(`bracesCaseId`, `kind`, `capturedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BracesRetentionCheck` (
    `id` VARCHAR(191) NOT NULL,
    `hospitalId` VARCHAR(191) NOT NULL,
    `bracesCaseId` VARCHAR(191) NOT NULL,
    `checkDate` DATETIME(3) NOT NULL,
    `retainerCondition` VARCHAR(191) NULL,
    `compliance` VARCHAR(191) NULL,
    `relapse` VARCHAR(191) NULL,
    `notes` TEXT NULL,
    `doctorId` VARCHAR(191) NULL,
    `createdById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `BracesRetentionCheck_hospitalId_idx`(`hospitalId`),
    INDEX `BracesRetentionCheck_bracesCaseId_checkDate_idx`(`bracesCaseId`, `checkDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `BracesAssessment` ADD CONSTRAINT `BracesAssessment_bracesCaseId_fkey` FOREIGN KEY (`bracesCaseId`) REFERENCES `BracesCase`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BracesMedia` ADD CONSTRAINT `BracesMedia_bracesCaseId_fkey` FOREIGN KEY (`bracesCaseId`) REFERENCES `BracesCase`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BracesRetentionCheck` ADD CONSTRAINT `BracesRetentionCheck_bracesCaseId_fkey` FOREIGN KEY (`bracesCaseId`) REFERENCES `BracesCase`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
