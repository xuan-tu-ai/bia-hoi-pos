-- CreateEnum
CREATE TYPE "Role" AS ENUM ('COUNTER', 'SHIFT_MANAGER', 'OWNER');

-- CreateEnum
CREATE TYPE "TabStatus" AS ENUM ('OPEN', 'PAID', 'MERGED');

-- CreateEnum
CREATE TYPE "PrintStatus" AS ENUM ('PENDING', 'PRINTED', 'FAILED');

-- CreateEnum
CREATE TYPE "LineType" AS ENUM ('NORMAL', 'VOID', 'DISCOUNT');

-- CreateEnum
CREATE TYPE "AdjustReason" AS ENUM ('KHACH_DOI_Y', 'BEP_HET_MON', 'NHAP_NHAM', 'MON_LOI', 'KHAC');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'TRANSFER');

-- CreateEnum
CREATE TYPE "BillKind" AS ENUM ('PROVISIONAL', 'FINAL');

-- CreateEnum
CREATE TYPE "KegStatus" AS ENUM ('IN_STOCK', 'TAPPED', 'EMPTY');

-- CreateTable
CREATE TABLE "staff" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "pin_hash" TEXT NOT NULL,
    "email" TEXT,
    "password_hash" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "area" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "area_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dining_table" (
    "id" SERIAL NOT NULL,
    "area_id" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "current_tab_id" INTEGER,

    CONSTRAINT "dining_table_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "menu_group" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "menu_group_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "menu_item" (
    "id" SERIAL NOT NULL,
    "group_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "shortcut" TEXT,
    "price" INTEGER NOT NULL,
    "unit" TEXT NOT NULL,
    "station_id" INTEGER,
    "beer_volume_ml" INTEGER,
    "default_tap_id" INTEGER,
    "available" BOOLEAN NOT NULL DEFAULT true,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "menu_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "happy_hour" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "days_of_week" INTEGER[],
    "start_minute" INTEGER NOT NULL,
    "end_minute" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "happy_hour_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "happy_hour_price" (
    "id" SERIAL NOT NULL,
    "happy_hour_id" INTEGER NOT NULL,
    "item_id" INTEGER NOT NULL,
    "price" INTEGER NOT NULL,

    CONSTRAINT "happy_hour_price_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "print_station" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "printer_name" TEXT NOT NULL,

    CONSTRAINT "print_station_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tab" (
    "id" SERIAL NOT NULL,
    "table_id" INTEGER NOT NULL,
    "opened_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "opened_by" INTEGER NOT NULL,
    "guest_count" INTEGER,
    "status" "TabStatus" NOT NULL DEFAULT 'OPEN',
    "closed_at" TIMESTAMP(3),
    "merged_into_id" INTEGER,

    CONSTRAINT "tab_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_round" (
    "id" SERIAL NOT NULL,
    "tab_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" INTEGER NOT NULL,
    "printed_status" "PrintStatus" NOT NULL DEFAULT 'PENDING',
    "note" TEXT,

    CONSTRAINT "order_round_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_line" (
    "id" SERIAL NOT NULL,
    "round_id" INTEGER NOT NULL,
    "item_id" INTEGER NOT NULL,
    "item_name" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "unit_price" INTEGER NOT NULL,
    "line_type" "LineType" NOT NULL DEFAULT 'NORMAL',
    "ref_line_id" INTEGER,
    "reason" "AdjustReason",
    "reason_note" TEXT,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" INTEGER NOT NULL,
    "approved_by" INTEGER,
    "happy_hour_id" INTEGER,
    "station_id" INTEGER,
    "keg_id" INTEGER,
    "volume_ml" INTEGER,

    CONSTRAINT "order_line_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bill_discount" (
    "id" SERIAL NOT NULL,
    "tab_id" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "percent" INTEGER,
    "reason" "AdjustReason" NOT NULL,
    "reason_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" INTEGER NOT NULL,
    "approved_by" INTEGER NOT NULL,

    CONSTRAINT "bill_discount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment" (
    "id" SERIAL NOT NULL,
    "tab_id" INTEGER NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "amount" INTEGER NOT NULL,
    "tendered" INTEGER,
    "received_by" INTEGER NOT NULL,
    "shift_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bill_print" (
    "id" SERIAL NOT NULL,
    "tab_id" INTEGER NOT NULL,
    "kind" "BillKind" NOT NULL,
    "print_no" INTEGER NOT NULL,
    "printed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "printed_by" INTEGER NOT NULL,

    CONSTRAINT "bill_print_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shift" (
    "id" SERIAL NOT NULL,
    "staff_id" INTEGER NOT NULL,
    "opened_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "opening_cash" INTEGER NOT NULL,
    "closed_at" TIMESTAMP(3),
    "closed_by" INTEGER,
    "counted_cash" INTEGER,
    "expected_cash" INTEGER,
    "summary" JSONB,

    CONSTRAINT "shift_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "keg" (
    "id" SERIAL NOT NULL,
    "beer_name" TEXT NOT NULL,
    "capacity_ml" INTEGER NOT NULL,
    "cost" INTEGER NOT NULL,
    "received_at" TIMESTAMP(3) NOT NULL,
    "status" "KegStatus" NOT NULL DEFAULT 'IN_STOCK',
    "tap_id" INTEGER,
    "tapped_at" TIMESTAMP(3),
    "emptied_at" TIMESTAMP(3),

    CONSTRAINT "keg_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tap" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "current_keg_id" INTEGER,

    CONSTRAINT "tap_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" SERIAL NOT NULL,
    "actor_id" INTEGER,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entity_id" INTEGER,
    "payload_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "staff_email_key" ON "staff"("email");

-- CreateIndex
CREATE UNIQUE INDEX "dining_table_code_key" ON "dining_table"("code");

-- CreateIndex
CREATE UNIQUE INDEX "dining_table_current_tab_id_key" ON "dining_table"("current_tab_id");

-- CreateIndex
CREATE UNIQUE INDEX "menu_item_shortcut_key" ON "menu_item"("shortcut");

-- CreateIndex
CREATE UNIQUE INDEX "happy_hour_price_happy_hour_id_item_id_key" ON "happy_hour_price"("happy_hour_id", "item_id");

-- CreateIndex
CREATE INDEX "tab_status_idx" ON "tab"("status");

-- CreateIndex
CREATE INDEX "tab_closed_at_idx" ON "tab"("closed_at");

-- CreateIndex
CREATE INDEX "order_round_tab_id_idx" ON "order_round"("tab_id");

-- CreateIndex
CREATE INDEX "order_round_created_at_idx" ON "order_round"("created_at");

-- CreateIndex
CREATE INDEX "order_line_round_id_idx" ON "order_line"("round_id");

-- CreateIndex
CREATE INDEX "order_line_ref_line_id_idx" ON "order_line"("ref_line_id");

-- CreateIndex
CREATE INDEX "order_line_keg_id_idx" ON "order_line"("keg_id");

-- CreateIndex
CREATE INDEX "order_line_line_type_created_at_idx" ON "order_line"("line_type", "created_at");

-- CreateIndex
CREATE INDEX "bill_discount_created_at_idx" ON "bill_discount"("created_at");

-- CreateIndex
CREATE INDEX "payment_created_at_idx" ON "payment"("created_at");

-- CreateIndex
CREATE INDEX "payment_shift_id_idx" ON "payment"("shift_id");

-- CreateIndex
CREATE INDEX "bill_print_tab_id_idx" ON "bill_print"("tab_id");

-- CreateIndex
CREATE INDEX "keg_status_idx" ON "keg"("status");

-- CreateIndex
CREATE UNIQUE INDEX "tap_current_keg_id_key" ON "tap"("current_keg_id");

-- CreateIndex
CREATE INDEX "audit_log_entity_entity_id_idx" ON "audit_log"("entity", "entity_id");

-- CreateIndex
CREATE INDEX "audit_log_created_at_idx" ON "audit_log"("created_at");

-- AddForeignKey
ALTER TABLE "dining_table" ADD CONSTRAINT "dining_table_area_id_fkey" FOREIGN KEY ("area_id") REFERENCES "area"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dining_table" ADD CONSTRAINT "dining_table_current_tab_id_fkey" FOREIGN KEY ("current_tab_id") REFERENCES "tab"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menu_item" ADD CONSTRAINT "menu_item_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "menu_group"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menu_item" ADD CONSTRAINT "menu_item_station_id_fkey" FOREIGN KEY ("station_id") REFERENCES "print_station"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menu_item" ADD CONSTRAINT "menu_item_default_tap_id_fkey" FOREIGN KEY ("default_tap_id") REFERENCES "tap"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "happy_hour_price" ADD CONSTRAINT "happy_hour_price_happy_hour_id_fkey" FOREIGN KEY ("happy_hour_id") REFERENCES "happy_hour"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "happy_hour_price" ADD CONSTRAINT "happy_hour_price_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "menu_item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tab" ADD CONSTRAINT "tab_table_id_fkey" FOREIGN KEY ("table_id") REFERENCES "dining_table"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tab" ADD CONSTRAINT "tab_opened_by_fkey" FOREIGN KEY ("opened_by") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tab" ADD CONSTRAINT "tab_merged_into_id_fkey" FOREIGN KEY ("merged_into_id") REFERENCES "tab"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_round" ADD CONSTRAINT "order_round_tab_id_fkey" FOREIGN KEY ("tab_id") REFERENCES "tab"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_round" ADD CONSTRAINT "order_round_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_line" ADD CONSTRAINT "order_line_round_id_fkey" FOREIGN KEY ("round_id") REFERENCES "order_round"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_line" ADD CONSTRAINT "order_line_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "menu_item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_line" ADD CONSTRAINT "order_line_ref_line_id_fkey" FOREIGN KEY ("ref_line_id") REFERENCES "order_line"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_line" ADD CONSTRAINT "order_line_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_line" ADD CONSTRAINT "order_line_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_line" ADD CONSTRAINT "order_line_happy_hour_id_fkey" FOREIGN KEY ("happy_hour_id") REFERENCES "happy_hour"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_line" ADD CONSTRAINT "order_line_station_id_fkey" FOREIGN KEY ("station_id") REFERENCES "print_station"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_line" ADD CONSTRAINT "order_line_keg_id_fkey" FOREIGN KEY ("keg_id") REFERENCES "keg"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bill_discount" ADD CONSTRAINT "bill_discount_tab_id_fkey" FOREIGN KEY ("tab_id") REFERENCES "tab"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bill_discount" ADD CONSTRAINT "bill_discount_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bill_discount" ADD CONSTRAINT "bill_discount_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment" ADD CONSTRAINT "payment_tab_id_fkey" FOREIGN KEY ("tab_id") REFERENCES "tab"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment" ADD CONSTRAINT "payment_received_by_fkey" FOREIGN KEY ("received_by") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment" ADD CONSTRAINT "payment_shift_id_fkey" FOREIGN KEY ("shift_id") REFERENCES "shift"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bill_print" ADD CONSTRAINT "bill_print_tab_id_fkey" FOREIGN KEY ("tab_id") REFERENCES "tab"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bill_print" ADD CONSTRAINT "bill_print_printed_by_fkey" FOREIGN KEY ("printed_by") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift" ADD CONSTRAINT "shift_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift" ADD CONSTRAINT "shift_closed_by_fkey" FOREIGN KEY ("closed_by") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "keg" ADD CONSTRAINT "keg_tap_id_fkey" FOREIGN KEY ("tap_id") REFERENCES "tap"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tap" ADD CONSTRAINT "tap_current_keg_id_fkey" FOREIGN KEY ("current_keg_id") REFERENCES "keg"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
