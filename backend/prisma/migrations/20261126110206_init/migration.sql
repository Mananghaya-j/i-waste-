-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('RESIDENT', 'ADMIN', 'SUPER_ADMIN');

-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('SUBMITTED', 'UNDER_REVIEW', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'REJECTED');

-- CreateEnum
CREATE TYPE "PickupCategory" AS ENUM ('NORMAL', 'SPECIAL', 'COOKING_OIL');

-- CreateEnum
CREATE TYPE "TreeRequestType" AS ENUM ('CUTTING', 'PRUNING');

-- CreateEnum
CREATE TYPE "LandClassification" AS ENUM ('PRIVATE', 'PUBLIC');

-- CreateEnum
CREATE TYPE "TruckStatus" AS ENUM ('ACTIVE', 'IDLE', 'MAINTENANCE', 'ROUTE_COMPLETED');

-- CreateEnum
CREATE TYPE "EnvironmentalReportType" AS ENUM ('ILLEGAL_DUMPING', 'MISSED_COLLECTION', 'OTHER');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('REQUEST_UPDATE', 'TRUCK_STATUS', 'COMPLETION', 'ADMIN_ALERT');

-- CreateEnum
CREATE TYPE "TripStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "full_name" VARCHAR(120) NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "contact_number" VARCHAR(24),
    "password_hash" VARCHAR(255) NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'RESIDENT',
    "status" "AccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "email_verified_at" TIMESTAMPTZ(3),
    "failed_login_attempts" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMPTZ(3),
    "permissions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL,
    "token_hash" VARCHAR(64) NOT NULL,
    "user_id" UUID NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "revoked_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id" UUID NOT NULL,
    "token_hash" VARCHAR(64) NOT NULL,
    "user_id" UUID NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "used_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_verification_tokens" (
    "id" UUID NOT NULL,
    "token_hash" VARCHAR(64) NOT NULL,
    "user_id" UUID NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "used_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_verification_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "actor_id" UUID,
    "action" VARCHAR(80) NOT NULL,
    "entity_type" VARCHAR(80) NOT NULL,
    "entity_id" VARCHAR(80),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "ip_address" VARCHAR(45),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trucks" (
    "id" UUID NOT NULL,
    "truck_id" VARCHAR(32) NOT NULL,
    "plate_number" VARCHAR(20) NOT NULL,
    "vehicle_type" VARCHAR(80) NOT NULL,
    "capacity_kg" DECIMAL(10,2),
    "driver_name" VARCHAR(120),
    "crew" VARCHAR(500),
    "qr_code_value" VARCHAR(80) NOT NULL,
    "status" "TruckStatus" NOT NULL DEFAULT 'IDLE',
    "current_street" VARCHAR(160),
    "admin_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "trucks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "routes" (
    "id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "description" VARCHAR(500),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "routes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "route_checkpoints" (
    "id" UUID NOT NULL,
    "route_id" UUID NOT NULL,
    "sequence" INTEGER NOT NULL,
    "street_name" VARCHAR(160) NOT NULL,
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(9,6),

    CONSTRAINT "route_checkpoints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trip_tickets" (
    "id" UUID NOT NULL,
    "trip_no" VARCHAR(32) NOT NULL,
    "truck_id" UUID NOT NULL,
    "route_id" UUID,
    "created_by_id" UUID NOT NULL,
    "status" "TripStatus" NOT NULL DEFAULT 'ACTIVE',
    "started_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trip_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trip_checkpoints" (
    "id" UUID NOT NULL,
    "trip_ticket_id" UUID NOT NULL,
    "route_checkpoint_id" UUID,
    "street_name" VARCHAR(160) NOT NULL,
    "arrived_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "completed_at" TIMESTAMPTZ(3),

    CONSTRAINT "trip_checkpoints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pickup_requests" (
    "id" UUID NOT NULL,
    "reference_no" VARCHAR(32) NOT NULL,
    "requester_id" UUID,
    "full_name" VARCHAR(120),
    "contact_number" VARCHAR(24) NOT NULL,
    "email" VARCHAR(254),
    "address" VARCHAR(300) NOT NULL,
    "category" "PickupCategory" NOT NULL,
    "special_waste_type" VARCHAR(80),
    "other_waste" VARCHAR(160),
    "oil_quantity_liters" DECIMAL(10,2),
    "description" VARCHAR(1000),
    "status" "RequestStatus" NOT NULL DEFAULT 'SUBMITTED',
    "admin_notes" VARCHAR(1000),
    "assigned_truck_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "pickup_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tree_requests" (
    "id" UUID NOT NULL,
    "reference_no" VARCHAR(32) NOT NULL,
    "requester_id" UUID,
    "full_name" VARCHAR(120),
    "contact_number" VARCHAR(24) NOT NULL,
    "location" VARCHAR(300) NOT NULL,
    "land_classification" "LandClassification" NOT NULL,
    "request_type" "TreeRequestType" NOT NULL,
    "tree_type" VARCHAR(80),
    "hazard_description" VARCHAR(1000) NOT NULL,
    "denr_document_reference" VARCHAR(160),
    "instructions_accepted" BOOLEAN NOT NULL,
    "status" "RequestStatus" NOT NULL DEFAULT 'SUBMITTED',
    "admin_notes" VARCHAR(1000),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "tree_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "waterway_requests" (
    "id" UUID NOT NULL,
    "reference_no" VARCHAR(32) NOT NULL,
    "requester_id" UUID,
    "full_name" VARCHAR(120),
    "contact_number" VARCHAR(24) NOT NULL,
    "location" VARCHAR(300) NOT NULL,
    "issue_type" VARCHAR(80) NOT NULL,
    "description" VARCHAR(1000) NOT NULL,
    "status" "RequestStatus" NOT NULL DEFAULT 'SUBMITTED',
    "admin_notes" VARCHAR(1000),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "waterway_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "environmental_reports" (
    "id" UUID NOT NULL,
    "reference_no" VARCHAR(32) NOT NULL,
    "requester_id" UUID,
    "anonymous" BOOLEAN NOT NULL DEFAULT false,
    "full_name" VARCHAR(120),
    "contact_number" VARCHAR(24),
    "type" "EnvironmentalReportType" NOT NULL,
    "location" VARCHAR(300) NOT NULL,
    "description" VARCHAR(1500) NOT NULL,
    "status" "RequestStatus" NOT NULL DEFAULT 'SUBMITTED',
    "investigation_notes" VARCHAR(1500),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "environmental_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attachments" (
    "id" UUID NOT NULL,
    "storage_key" VARCHAR(255) NOT NULL,
    "original_name" VARCHAR(255) NOT NULL,
    "mime_type" VARCHAR(100) NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "purpose" VARCHAR(40) NOT NULL,
    "uploaded_by_id" UUID,
    "pickup_request_id" UUID,
    "tree_request_id" UUID,
    "waterway_request_id" UUID,
    "environmental_report_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "type" "NotificationType" NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "message" VARCHAR(1000) NOT NULL,
    "entity_type" VARCHAR(80),
    "entity_id" VARCHAR(80),
    "read_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "request_status_history" (
    "id" UUID NOT NULL,
    "request_kind" VARCHAR(32) NOT NULL,
    "reference_no" VARCHAR(32) NOT NULL,
    "from_status" "RequestStatus",
    "to_status" "RequestStatus" NOT NULL,
    "actor_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "request_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "announcements" (
    "id" UUID NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "body" VARCHAR(4000) NOT NULL,
    "published_at" TIMESTAMPTZ(3),
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "announcements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_settings" (
    "key" VARCHAR(80) NOT NULL,
    "value" JSONB NOT NULL,
    "updated_by_id" UUID,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE INDEX "users_status_idx" ON "users"("status");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_expires_at_idx" ON "refresh_tokens"("user_id", "expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_tokens_token_hash_key" ON "password_reset_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "password_reset_tokens_user_id_expires_at_idx" ON "password_reset_tokens"("user_id", "expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "email_verification_tokens_token_hash_key" ON "email_verification_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "email_verification_tokens_user_id_expires_at_idx" ON "email_verification_tokens"("user_id", "expires_at");

-- CreateIndex
CREATE INDEX "audit_logs_actor_id_created_at_idx" ON "audit_logs"("actor_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_created_at_idx" ON "audit_logs"("entity_type", "entity_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "trucks_truck_id_key" ON "trucks"("truck_id");

-- CreateIndex
CREATE UNIQUE INDEX "trucks_plate_number_key" ON "trucks"("plate_number");

-- CreateIndex
CREATE UNIQUE INDEX "trucks_qr_code_value_key" ON "trucks"("qr_code_value");

-- CreateIndex
CREATE INDEX "trucks_status_idx" ON "trucks"("status");

-- CreateIndex
CREATE INDEX "trucks_admin_id_idx" ON "trucks"("admin_id");

-- CreateIndex
CREATE INDEX "routes_is_active_idx" ON "routes"("is_active");

-- CreateIndex
CREATE INDEX "route_checkpoints_route_id_idx" ON "route_checkpoints"("route_id");

-- CreateIndex
CREATE UNIQUE INDEX "route_checkpoints_route_id_sequence_key" ON "route_checkpoints"("route_id", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "trip_tickets_trip_no_key" ON "trip_tickets"("trip_no");

-- CreateIndex
CREATE INDEX "trip_tickets_truck_id_started_at_idx" ON "trip_tickets"("truck_id", "started_at");

-- CreateIndex
CREATE INDEX "trip_tickets_route_id_idx" ON "trip_tickets"("route_id");

-- CreateIndex
CREATE INDEX "trip_tickets_status_idx" ON "trip_tickets"("status");

-- CreateIndex
CREATE INDEX "trip_checkpoints_trip_ticket_id_arrived_at_idx" ON "trip_checkpoints"("trip_ticket_id", "arrived_at");

-- CreateIndex
CREATE UNIQUE INDEX "pickup_requests_reference_no_key" ON "pickup_requests"("reference_no");

-- CreateIndex
CREATE INDEX "pickup_requests_status_created_at_idx" ON "pickup_requests"("status", "created_at");

-- CreateIndex
CREATE INDEX "pickup_requests_created_at_idx" ON "pickup_requests"("created_at");

-- CreateIndex
CREATE INDEX "pickup_requests_requester_id_created_at_idx" ON "pickup_requests"("requester_id", "created_at");

-- CreateIndex
CREATE INDEX "pickup_requests_assigned_truck_id_idx" ON "pickup_requests"("assigned_truck_id");

-- CreateIndex
CREATE UNIQUE INDEX "tree_requests_reference_no_key" ON "tree_requests"("reference_no");

-- CreateIndex
CREATE INDEX "tree_requests_status_created_at_idx" ON "tree_requests"("status", "created_at");

-- CreateIndex
CREATE INDEX "tree_requests_created_at_idx" ON "tree_requests"("created_at");

-- CreateIndex
CREATE INDEX "tree_requests_requester_id_created_at_idx" ON "tree_requests"("requester_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "waterway_requests_reference_no_key" ON "waterway_requests"("reference_no");

-- CreateIndex
CREATE INDEX "waterway_requests_status_created_at_idx" ON "waterway_requests"("status", "created_at");

-- CreateIndex
CREATE INDEX "waterway_requests_created_at_idx" ON "waterway_requests"("created_at");

-- CreateIndex
CREATE INDEX "waterway_requests_requester_id_created_at_idx" ON "waterway_requests"("requester_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "environmental_reports_reference_no_key" ON "environmental_reports"("reference_no");

-- CreateIndex
CREATE INDEX "environmental_reports_type_status_created_at_idx" ON "environmental_reports"("type", "status", "created_at");

-- CreateIndex
CREATE INDEX "environmental_reports_status_created_at_idx" ON "environmental_reports"("status", "created_at");

-- CreateIndex
CREATE INDEX "environmental_reports_created_at_idx" ON "environmental_reports"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "attachments_storage_key_key" ON "attachments"("storage_key");

-- CreateIndex
CREATE INDEX "attachments_pickup_request_id_idx" ON "attachments"("pickup_request_id");

-- CreateIndex
CREATE INDEX "attachments_tree_request_id_idx" ON "attachments"("tree_request_id");

-- CreateIndex
CREATE INDEX "attachments_waterway_request_id_idx" ON "attachments"("waterway_request_id");

-- CreateIndex
CREATE INDEX "attachments_environmental_report_id_idx" ON "attachments"("environmental_report_id");

-- CreateIndex
CREATE INDEX "notifications_user_id_read_at_created_at_idx" ON "notifications"("user_id", "read_at", "created_at");

-- CreateIndex
CREATE INDEX "notifications_created_at_idx" ON "notifications"("created_at");

-- CreateIndex
CREATE INDEX "request_status_history_reference_no_created_at_idx" ON "request_status_history"("reference_no", "created_at");

-- CreateIndex
CREATE INDEX "announcements_published_at_created_at_idx" ON "announcements"("published_at", "created_at");

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_verification_tokens" ADD CONSTRAINT "email_verification_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trucks" ADD CONSTRAINT "trucks_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "route_checkpoints" ADD CONSTRAINT "route_checkpoints_route_id_fkey" FOREIGN KEY ("route_id") REFERENCES "routes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_tickets" ADD CONSTRAINT "trip_tickets_truck_id_fkey" FOREIGN KEY ("truck_id") REFERENCES "trucks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_tickets" ADD CONSTRAINT "trip_tickets_route_id_fkey" FOREIGN KEY ("route_id") REFERENCES "routes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_tickets" ADD CONSTRAINT "trip_tickets_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_checkpoints" ADD CONSTRAINT "trip_checkpoints_trip_ticket_id_fkey" FOREIGN KEY ("trip_ticket_id") REFERENCES "trip_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pickup_requests" ADD CONSTRAINT "pickup_requests_requester_id_fkey" FOREIGN KEY ("requester_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pickup_requests" ADD CONSTRAINT "pickup_requests_assigned_truck_id_fkey" FOREIGN KEY ("assigned_truck_id") REFERENCES "trucks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tree_requests" ADD CONSTRAINT "tree_requests_requester_id_fkey" FOREIGN KEY ("requester_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "waterway_requests" ADD CONSTRAINT "waterway_requests_requester_id_fkey" FOREIGN KEY ("requester_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "environmental_reports" ADD CONSTRAINT "environmental_reports_requester_id_fkey" FOREIGN KEY ("requester_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_pickup_request_id_fkey" FOREIGN KEY ("pickup_request_id") REFERENCES "pickup_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_tree_request_id_fkey" FOREIGN KEY ("tree_request_id") REFERENCES "tree_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_waterway_request_id_fkey" FOREIGN KEY ("waterway_request_id") REFERENCES "waterway_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_environmental_report_id_fkey" FOREIGN KEY ("environmental_report_id") REFERENCES "environmental_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_status_history" ADD CONSTRAINT "request_status_history_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "system_settings" ADD CONSTRAINT "system_settings_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
