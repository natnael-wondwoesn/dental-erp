-- CreateTable
CREATE TABLE `DentalExamination` (
    `id` VARCHAR(191) NOT NULL,
    `hospitalId` VARCHAR(191) NOT NULL,
    `patientId` VARCHAR(191) NOT NULL,
    `examinedAt` DATETIME(3) NOT NULL,
    `dentistId` VARCHAR(191) NULL,
    `dentistName` VARCHAR(191) NOT NULL,
    `teeth` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `DentalExamination_hospitalId_idx`(`hospitalId`),
    INDEX `DentalExamination_patientId_examinedAt_idx`(`patientId`, `examinedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `DentalExamination` ADD CONSTRAINT `DentalExamination_hospitalId_fkey` FOREIGN KEY (`hospitalId`) REFERENCES `Hospital`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DentalExamination` ADD CONSTRAINT `DentalExamination_patientId_fkey` FOREIGN KEY (`patientId`) REFERENCES `Patient`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
