-- CreateTable
CREATE TABLE "held_financial_files" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "branch" VARCHAR(40) NOT NULL,
    "slot_key" VARCHAR(40) NOT NULL,
    "upload_session_id" VARCHAR(64) NOT NULL,
    "original_name" VARCHAR(255) NOT NULL,
    "storage_path" VARCHAR(500) NOT NULL,
    "size_bytes" BIGINT NOT NULL,
    "content_type" VARCHAR(120),
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "held_financial_files_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "held_financial_files_user_id_branch_idx" ON "held_financial_files"("user_id", "branch");

-- CreateIndex
CREATE INDEX "held_financial_files_expires_at_idx" ON "held_financial_files"("expires_at");

-- CreateIndex
CREATE INDEX "held_financial_files_upload_session_id_idx" ON "held_financial_files"("upload_session_id");

-- CreateIndex
CREATE UNIQUE INDEX "held_financial_files_user_id_branch_slot_key_key" ON "held_financial_files"("user_id", "branch", "slot_key");

-- AddForeignKey
ALTER TABLE "held_financial_files" ADD CONSTRAINT "held_financial_files_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
