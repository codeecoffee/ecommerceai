/*
  Warnings:

  - The primary key for the `Order_item` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `order_item` on the `Order_item` table. All the data in the column will be lost.
  - The required column `order_item_id` was added to the `Order_item` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.

*/
-- AlterTable
ALTER TABLE "Order_item" DROP CONSTRAINT "Order_item_pkey",
DROP COLUMN "order_item",
ADD COLUMN     "order_item_id" TEXT NOT NULL,
ADD CONSTRAINT "Order_item_pkey" PRIMARY KEY ("order_item_id");
