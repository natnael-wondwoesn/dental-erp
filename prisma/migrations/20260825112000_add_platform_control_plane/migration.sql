ALTER TABLE `User` ADD COLUMN `isPlatformOwner` BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE `PlatformCustomer` (
  `id` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `slug` VARCHAR(191) NOT NULL,
  `contactName` VARCHAR(191) NULL,
  `contactEmail` VARCHAR(191) NULL,
  `contactPhone` VARCHAR(191) NULL,
  `status` VARCHAR(191) NOT NULL DEFAULT 'ACTIVE',
  `notes` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `PlatformCustomer_slug_key`(`slug`),
  INDEX `PlatformCustomer_status_idx`(`status`),
  INDEX `PlatformCustomer_name_idx`(`name`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `PlatformProduct` (
  `id` VARCHAR(191) NOT NULL,
  `key` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `category` VARCHAR(191) NOT NULL,
  `repository` VARCHAR(191) NULL,
  `imageRepository` VARCHAR(191) NULL,
  `description` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `PlatformProduct_key_key`(`key`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `PlatformInstallation` (
  `id` VARCHAR(191) NOT NULL,
  `customerId` VARCHAR(191) NOT NULL,
  `productId` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `slug` VARCHAR(191) NOT NULL,
  `hostname` VARCHAR(191) NOT NULL,
  `environment` VARCHAR(191) NOT NULL DEFAULT 'production',
  `status` VARCHAR(191) NOT NULL DEFAULT 'PLANNED',
  `version` VARCHAR(191) NULL,
  `composeProject` VARCHAR(191) NULL,
  `healthUrl` VARCHAR(191) NULL,
  `features` JSON NULL,
  `licenseExpiresAt` DATETIME(3) NULL,
  `lastHealthStatus` VARCHAR(191) NULL,
  `lastHealthAt` DATETIME(3) NULL,
  `lastBackupAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `PlatformInstallation_slug_key`(`slug`),
  UNIQUE INDEX `PlatformInstallation_hostname_key`(`hostname`),
  UNIQUE INDEX `PlatformInstallation_composeProject_key`(`composeProject`),
  INDEX `PlatformInstallation_customerId_idx`(`customerId`),
  INDEX `PlatformInstallation_productId_idx`(`productId`),
  INDEX `PlatformInstallation_status_idx`(`status`),
  INDEX `PlatformInstallation_licenseExpiresAt_idx`(`licenseExpiresAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `PlatformOperation` (
  `id` VARCHAR(191) NOT NULL,
  `installationId` VARCHAR(191) NULL,
  `requestedById` VARCHAR(191) NOT NULL,
  `action` VARCHAR(191) NOT NULL,
  `status` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
  `request` JSON NULL,
  `result` JSON NULL,
  `error` TEXT NULL,
  `startedAt` DATETIME(3) NULL,
  `completedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `PlatformOperation_installationId_idx`(`installationId`),
  INDEX `PlatformOperation_requestedById_idx`(`requestedById`),
  INDEX `PlatformOperation_status_createdAt_idx`(`status`, `createdAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `PlatformInstallation`
  ADD CONSTRAINT `PlatformInstallation_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `PlatformCustomer`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `PlatformInstallation_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `PlatformProduct`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `PlatformOperation`
  ADD CONSTRAINT `PlatformOperation_installationId_fkey` FOREIGN KEY (`installationId`) REFERENCES `PlatformInstallation`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `PlatformOperation_requestedById_fkey` FOREIGN KEY (`requestedById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO `PlatformProduct` (`id`, `key`, `name`, `category`, `repository`, `imageRepository`, `description`, `createdAt`, `updatedAt`)
VALUES
  ('platform_product_dental_erp', 'dental-erp', 'Dental ERP', 'ERP', 'natnael-wondwoesn/dental-erp', 'ghcr.io/natnael-wondwoesn/dental-erp', 'Dental clinic operations, clinical care, billing, laboratory, finance, and reporting.', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  ('platform_product_clinic_cms', 'clinic-cms', 'Clinic CMS', 'CMS', 'natnael-wondwoesn/clinic-cms', 'ghcr.io/natnael-wondwoesn/clinic-cms', 'Clinic website and content management product.', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3));
