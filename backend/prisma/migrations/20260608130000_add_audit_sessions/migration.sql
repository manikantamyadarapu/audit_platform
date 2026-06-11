-- CreateTable
CREATE TABLE "audit_sessions" (
    "id" SERIAL NOT NULL,
    "audit_run_id" INTEGER,
    "audit_type_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "session_key" VARCHAR(100) NOT NULL,
    "page_route" VARCHAR(255) NOT NULL,
    "file_name" VARCHAR(255),
    "status" "AuditStatus" NOT NULL DEFAULT 'PENDING',
    "session_data" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "last_accessed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "audit_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "audit_sessions_session_key_key" ON "audit_sessions"("session_key");

-- CreateIndex
CREATE INDEX "audit_sessions_user_id_audit_type_id_idx" ON "audit_sessions"("user_id", "audit_type_id");

-- CreateIndex
CREATE INDEX "audit_sessions_expires_at_idx" ON "audit_sessions"("expires_at");

-- CreateIndex
CREATE INDEX "audit_sessions_is_active_idx" ON "audit_sessions"("is_active");

-- AddForeignKey
ALTER TABLE "audit_sessions" ADD CONSTRAINT "audit_sessions_audit_run_id_fkey" FOREIGN KEY ("audit_run_id") REFERENCES "audit_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_sessions" ADD CONSTRAINT "audit_sessions_audit_type_id_fkey" FOREIGN KEY ("audit_type_id") REFERENCES "audit_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_sessions" ADD CONSTRAINT "audit_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
