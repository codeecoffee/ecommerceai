/*
  Warnings:

  - You are about to drop the column `raiting` on the `Post` table. All the data in the column will be lost.
  - Added the required column `rating` to the `Post` table without a default value. This is not possible if the table is not empty.
  - Added the required column `title` to the `Post` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Post" DROP COLUMN "raiting",
ADD COLUMN     "rating" INTEGER NOT NULL,
ADD COLUMN     "title" TEXT NOT NULL;
