ALTER TABLE `Payment`
  ADD COLUMN `providerName` VARCHAR(191) NULL,
  ADD COLUMN `recordedById` VARCHAR(191) NULL,
  MODIFY `paymentMethod` ENUM(
    'CASH',
    'CARD',
    'UPI',
    'TELEBIRR',
    'BANK_TRANSFER',
    'CHEQUE',
    'INSURANCE',
    'WALLET',
    'ONLINE',
    'OTHER'
  ) NOT NULL;

CREATE INDEX `Payment_recordedById_idx` ON `Payment`(`recordedById`);

ALTER TABLE `Payment`
  ADD CONSTRAINT `Payment_recordedById_fkey`
  FOREIGN KEY (`recordedById`) REFERENCES `User`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;
