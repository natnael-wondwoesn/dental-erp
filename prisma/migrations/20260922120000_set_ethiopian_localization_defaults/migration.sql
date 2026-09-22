-- New clinics and subscriptions must inherit the Ethiopian product defaults.
ALTER TABLE `Hospital`
  MODIFY `locale` VARCHAR(191) NOT NULL DEFAULT 'en-ET',
  MODIFY `country` VARCHAR(191) NOT NULL DEFAULT 'ET',
  MODIFY `currency` VARCHAR(191) NOT NULL DEFAULT 'ETB',
  MODIFY `timezone` VARCHAR(191) NOT NULL DEFAULT 'Africa/Addis_Ababa';

ALTER TABLE `SubscriptionPayment`
  MODIFY `currency` VARCHAR(191) NOT NULL DEFAULT 'ETB';

-- Records that still have the untouched legacy product defaults are Ethiopian
-- installations, not explicit tenant choices. Preserve every customised row.
UPDATE `Hospital`
SET
  `locale` = 'en-ET',
  `country` = 'ET',
  `currency` = 'ETB',
  `timezone` = 'Africa/Addis_Ababa'
WHERE
  `locale` = 'en-IN'
  AND `country` = 'IN'
  AND `currency` = 'INR'
  AND `timezone` = 'Asia/Kolkata';
