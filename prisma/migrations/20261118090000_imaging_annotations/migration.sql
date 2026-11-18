-- Additive only: drawings and measurements saved separately from the image file.
ALTER TABLE `BracesMedia` ADD COLUMN `annotations` JSON NULL;
