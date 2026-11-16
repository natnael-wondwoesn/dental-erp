-- Additive only: two optional columns on the categorised image record.
ALTER TABLE `BracesMedia`
    ADD COLUMN `title` VARCHAR(191) NULL,
    ADD COLUMN `relatedVisitId` VARCHAR(191) NULL;
