-- CreateEnum
CREATE TYPE "PrinterConnection" AS ENUM ('BROWSER', 'NETWORK');

-- AlterTable
ALTER TABLE "print_station" ADD COLUMN     "connection" "PrinterConnection" NOT NULL DEFAULT 'BROWSER',
ADD COLUMN     "host" TEXT,
ADD COLUMN     "port" INTEGER NOT NULL DEFAULT 9100;
