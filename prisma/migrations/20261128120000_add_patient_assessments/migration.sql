-- Additive only: one new table for per-visit treatment notes. Nothing existing is changed or dropped.

-- CreateTable
CREATE TABLE `PatientAssessment` (
    `id` VARCHAR(191) NOT NULL,
    `hospitalId` VARCHAR(191) NOT NULL,
    `patientId` VARCHAR(191) NOT NULL,
    `doctorId` VARCHAR(191) NOT NULL,
    `vitalSigns` TEXT NULL,
    `others` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `PatientAssessment_hospitalId_idx`(`hospitalId`),
    INDEX `PatientAssessment_patientId_createdAt_idx`(`patientId`, `createdAt`),
    INDEX `PatientAssessment_doctorId_idx`(`doctorId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `PatientAssessment` ADD CONSTRAINT `PatientAssessment_hospitalId_fkey` FOREIGN KEY (`hospitalId`) REFERENCES `Hospital`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PatientAssessment` ADD CONSTRAINT `PatientAssessment_patientId_fkey` FOREIGN KEY (`patientId`) REFERENCES `Patient`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PatientAssessment` ADD CONSTRAINT `PatientAssessment_doctorId_fkey` FOREIGN KEY (`doctorId`) REFERENCES `Staff`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
