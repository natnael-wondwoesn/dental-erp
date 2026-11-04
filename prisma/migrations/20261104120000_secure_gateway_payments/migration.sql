CREATE TABLE `PaymentOrder` (
  `id` VARCHAR(191) NOT NULL,
  `hospitalId` VARCHAR(191) NOT NULL,
  `invoiceId` VARCHAR(191) NOT NULL,
  `paymentLinkId` VARCHAR(191) NULL,
  `provider` VARCHAR(191) NOT NULL,
  `orderId` VARCHAR(191) NOT NULL,
  `amount` DECIMAL(10, 2) NOT NULL,
  `currency` VARCHAR(191) NOT NULL,
  `expiresAt` DATETIME(3) NOT NULL,
  `consumedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `PaymentOrder_provider_orderId_key`(`provider`, `orderId`),
  INDEX `PaymentOrder_hospitalId_invoiceId_idx`(`hospitalId`, `invoiceId`),
  INDEX `PaymentOrder_paymentLinkId_idx`(`paymentLinkId`),
  PRIMARY KEY (`id`),
  CONSTRAINT `PaymentOrder_hospitalId_fkey` FOREIGN KEY (`hospitalId`) REFERENCES `Hospital`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `PaymentOrder_invoiceId_fkey` FOREIGN KEY (`invoiceId`) REFERENCES `Invoice`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE UNIQUE INDEX `Payment_gateway_gatewayPaymentId_key` ON `Payment`(`gateway`, `gatewayPaymentId`);
