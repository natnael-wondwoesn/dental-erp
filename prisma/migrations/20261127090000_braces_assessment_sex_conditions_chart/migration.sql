ALTER TABLE `BracesAssessment`
  ADD COLUMN `sex` VARCHAR(191) NULL,
  ADD COLUMN `medicalConditions` JSON NULL,
  ADD COLUMN `medicalOther` TEXT NULL,
  ADD COLUMN `palmerChart` JSON NULL;
