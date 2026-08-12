-- DropForeignKey
ALTER TABLE "Post" DROP CONSTRAINT "Post_product_id_fkey";

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "Product"("prod_id") ON DELETE CASCADE ON UPDATE CASCADE;
