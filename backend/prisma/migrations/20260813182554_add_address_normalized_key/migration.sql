/*
  Warnings:

  - A unique constraint covering the columns `[normalized_key]` on the table `Address` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `normalized_key` to the `Address` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Address" ADD COLUMN     "normalized_key" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Address_normalized_key_key" ON "Address"("normalized_key");
