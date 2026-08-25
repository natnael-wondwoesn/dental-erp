CREATE TABLE `ClinicalInkNote` (
  `id` VARCHAR(191) NOT NULL,
  `hospitalId` VARCHAR(191) NOT NULL,
  `patientId` VARCHAR(191) NOT NULL,
  `treatmentId` VARCHAR(191) NOT NULL,
  `createdById` VARCHAR(191) NOT NULL,
  `kind` VARCHAR(191) NOT NULL DEFAULT 'DIAGNOSIS',
  `inkVersion` INTEGER NOT NULL DEFAULT 1,
  `document` JSON NOT NULL,
  `strokeCount` INTEGER NOT NULL,
  `canvasWidth` INTEGER NOT NULL,
  `canvasHeight` INTEGER NOT NULL,
  `deviceType` VARCHAR(191) NULL,
  `finalizedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  INDEX `ClinicalInkNote_hospitalId_idx`(`hospitalId`),
  INDEX `ClinicalInkNote_patientId_idx`(`patientId`),
  INDEX `ClinicalInkNote_treatmentId_idx`(`treatmentId`),
  INDEX `ClinicalInkNote_createdById_idx`(`createdById`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `ClinicalInkNote`
  ADD CONSTRAINT `ClinicalInkNote_hospitalId_fkey`
  FOREIGN KEY (`hospitalId`) REFERENCES `Hospital`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `ClinicalInkNote_patientId_fkey`
  FOREIGN KEY (`patientId`) REFERENCES `Patient`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `ClinicalInkNote_treatmentId_fkey`
  FOREIGN KEY (`treatmentId`) REFERENCES `Treatment`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `ClinicalInkNote_createdById_fkey`
  FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
