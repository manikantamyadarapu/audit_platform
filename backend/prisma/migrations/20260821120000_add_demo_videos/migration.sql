-- CreateTable
CREATE TABLE "demo_videos" (
    "id" SERIAL NOT NULL,
    "module" VARCHAR(100) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "youtube_url" VARCHAR(500) NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "demo_videos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "demo_videos_module_key" ON "demo_videos"("module");

-- CreateIndex
CREATE INDEX "demo_videos_is_active_idx" ON "demo_videos"("is_active");

-- CreateIndex
CREATE INDEX "demo_videos_display_order_idx" ON "demo_videos"("display_order");
