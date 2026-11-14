-- CreateEnum
CREATE TYPE "Role" AS ENUM ('COUNTER', 'SHIFT_MANAGER', 'OWNER');

-- CreateEnum
CREATE TYPE "TabStatus" AS ENUM ('OPEN', 'PAID', 'MERGED');

-- CreateEnum
CREATE TYPE "LineType" AS ENUM ('NORMAL', 'VOID', 'DISCOUNT');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'TRANSFER');

-- CreateEnum
CREATE TYPE "BillPrintKind" AS ENUM ('PROVISIONAL', 'FINAL');

-- CreateEnum
CREATE TYPE "KegStatus" AS ENUM ('IN_STOCK', 'TAPPED', 'EMPTY');

-- CreateTable
CREATE TABLE "Staff" (
    "id" SERIAL NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "pinHash" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Staff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Area" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Area_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiningTable" (
    "id" SERIAL NOT NULL,
    "areaId" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "DiningTable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KitchenStation" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "KitchenStation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MenuGroup" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "MenuGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MenuItem" (
    "id" SERIAL NOT NULL,
    "groupId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "shortcut" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "unit" TEXT NOT NULL,
    "stationId" INTEGER NOT NULL,
    "beerVolumeMl" INTEGER,
    "defaultTapId" INTEGER,
    "available" BOOLEAN NOT NULL DEFAULT true,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "MenuItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HappyHour" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "weekdays" INTEGER[],
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "HappyHour_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HappyHourPrice" (
    "id" SERIAL NOT NULL,
    "happyHourId" INTEGER NOT NULL,
    "menuItemId" INTEGER NOT NULL,
    "price" INTEGER NOT NULL,

    CONSTRAINT "HappyHourPrice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tab" (
    "id" SERIAL NOT NULL,
    "tableId" INTEGER NOT NULL,
    "guestCount" INTEGER,
    "status" "TabStatus" NOT NULL DEFAULT 'OPEN',
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "openedById" INTEGER NOT NULL,
    "closedAt" TIMESTAMP(3),
    "billNo" TEXT,
    "billDiscount" INTEGER NOT NULL DEFAULT 0,
    "mergedIntoId" INTEGER,
    "billDiscountReason" TEXT,
    "billDiscountNote" TEXT,
    "billDiscountById" INTEGER,
    "billDiscountApprovedById" INTEGER,

    CONSTRAINT "Tab_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderRound" (
    "id" SERIAL NOT NULL,
    "tabId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" INTEGER NOT NULL,

    CONSTRAINT "OrderRound_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderLine" (
    "id" SERIAL NOT NULL,
    "roundId" INTEGER NOT NULL,
    "menuItemId" INTEGER NOT NULL,
    "qty" INTEGER NOT NULL,
    "unitPrice" INTEGER NOT NULL,
    "note" TEXT,
    "lineType" "LineType" NOT NULL DEFAULT 'NORMAL',
    "refLineId" INTEGER,
    "reason" TEXT,
    "requestedById" INTEGER,
    "approvedById" INTEGER,
    "tapId" INTEGER,
    "kegId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" SERIAL NOT NULL,
    "tabId" INTEGER NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "amount" INTEGER NOT NULL,
    "receivedById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillPrint" (
    "id" SERIAL NOT NULL,
    "tabId" INTEGER NOT NULL,
    "kind" "BillPrintKind" NOT NULL,
    "printNo" INTEGER NOT NULL,
    "printedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BillPrint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Shift" (
    "id" SERIAL NOT NULL,
    "staffId" INTEGER NOT NULL,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "openingCash" INTEGER NOT NULL,
    "closedAt" TIMESTAMP(3),
    "closedById" INTEGER,
    "countedCash" INTEGER,
    "cashSales" INTEGER,
    "transferSales" INTEGER,

    CONSTRAINT "Shift_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tap" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "currentKegId" INTEGER,

    CONSTRAINT "Tap_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Keg" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "beerName" TEXT NOT NULL,
    "capacityMl" INTEGER NOT NULL,
    "cost" INTEGER NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "status" "KegStatus" NOT NULL DEFAULT 'IN_STOCK',
    "tapId" INTEGER,
    "tappedAt" TIMESTAMP(3),
    "emptiedAt" TIMESTAMP(3),
    "soldMl" INTEGER,

    CONSTRAINT "Keg_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" SERIAL NOT NULL,
    "actorId" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" INTEGER NOT NULL,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Staff_email_key" ON "Staff"("email");

-- CreateIndex
CREATE UNIQUE INDEX "DiningTable_code_key" ON "DiningTable"("code");

-- CreateIndex
CREATE INDEX "DiningTable_areaId_idx" ON "DiningTable"("areaId");

-- CreateIndex
CREATE UNIQUE INDEX "MenuItem_shortcut_key" ON "MenuItem"("shortcut");

-- CreateIndex
CREATE UNIQUE INDEX "HappyHourPrice_happyHourId_menuItemId_key" ON "HappyHourPrice"("happyHourId", "menuItemId");

-- CreateIndex
CREATE UNIQUE INDEX "Tab_billNo_key" ON "Tab"("billNo");

-- CreateIndex
CREATE INDEX "Tab_status_idx" ON "Tab"("status");

-- CreateIndex
CREATE INDEX "Tab_tableId_status_idx" ON "Tab"("tableId", "status");

-- CreateIndex
CREATE INDEX "Tab_closedAt_idx" ON "Tab"("closedAt");

-- CreateIndex
CREATE INDEX "OrderRound_tabId_idx" ON "OrderRound"("tabId");

-- CreateIndex
CREATE INDEX "OrderLine_roundId_idx" ON "OrderLine"("roundId");

-- CreateIndex
CREATE INDEX "OrderLine_refLineId_idx" ON "OrderLine"("refLineId");

-- CreateIndex
CREATE INDEX "OrderLine_kegId_idx" ON "OrderLine"("kegId");

-- CreateIndex
CREATE INDEX "OrderLine_lineType_createdAt_idx" ON "OrderLine"("lineType", "createdAt");

-- CreateIndex
CREATE INDEX "Payment_tabId_idx" ON "Payment"("tabId");

-- CreateIndex
CREATE INDEX "Payment_createdAt_idx" ON "Payment"("createdAt");

-- CreateIndex
CREATE INDEX "BillPrint_tabId_idx" ON "BillPrint"("tabId");

-- CreateIndex
CREATE UNIQUE INDEX "Tap_currentKegId_key" ON "Tap"("currentKegId");

-- CreateIndex
CREATE UNIQUE INDEX "Keg_code_key" ON "Keg"("code");

-- CreateIndex
CREATE INDEX "Keg_status_idx" ON "Keg"("status");

-- CreateIndex
CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- AddForeignKey
ALTER TABLE "DiningTable" ADD CONSTRAINT "DiningTable_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuItem" ADD CONSTRAINT "MenuItem_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "MenuGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuItem" ADD CONSTRAINT "MenuItem_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "KitchenStation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuItem" ADD CONSTRAINT "MenuItem_defaultTapId_fkey" FOREIGN KEY ("defaultTapId") REFERENCES "Tap"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HappyHourPrice" ADD CONSTRAINT "HappyHourPrice_happyHourId_fkey" FOREIGN KEY ("happyHourId") REFERENCES "HappyHour"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HappyHourPrice" ADD CONSTRAINT "HappyHourPrice_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "MenuItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tab" ADD CONSTRAINT "Tab_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "DiningTable"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tab" ADD CONSTRAINT "Tab_openedById_fkey" FOREIGN KEY ("openedById") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tab" ADD CONSTRAINT "Tab_mergedIntoId_fkey" FOREIGN KEY ("mergedIntoId") REFERENCES "Tab"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tab" ADD CONSTRAINT "Tab_billDiscountById_fkey" FOREIGN KEY ("billDiscountById") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tab" ADD CONSTRAINT "Tab_billDiscountApprovedById_fkey" FOREIGN KEY ("billDiscountApprovedById") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderRound" ADD CONSTRAINT "OrderRound_tabId_fkey" FOREIGN KEY ("tabId") REFERENCES "Tab"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderRound" ADD CONSTRAINT "OrderRound_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderLine" ADD CONSTRAINT "OrderLine_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "OrderRound"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderLine" ADD CONSTRAINT "OrderLine_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "MenuItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderLine" ADD CONSTRAINT "OrderLine_refLineId_fkey" FOREIGN KEY ("refLineId") REFERENCES "OrderLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderLine" ADD CONSTRAINT "OrderLine_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderLine" ADD CONSTRAINT "OrderLine_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderLine" ADD CONSTRAINT "OrderLine_kegId_fkey" FOREIGN KEY ("kegId") REFERENCES "Keg"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_tabId_fkey" FOREIGN KEY ("tabId") REFERENCES "Tab"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_receivedById_fkey" FOREIGN KEY ("receivedById") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillPrint" ADD CONSTRAINT "BillPrint_tabId_fkey" FOREIGN KEY ("tabId") REFERENCES "Tab"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shift" ADD CONSTRAINT "Shift_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shift" ADD CONSTRAINT "Shift_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tap" ADD CONSTRAINT "Tap_currentKegId_fkey" FOREIGN KEY ("currentKegId") REFERENCES "Keg"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Keg" ADD CONSTRAINT "Keg_tapId_fkey" FOREIGN KEY ("tapId") REFERENCES "Tap"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
