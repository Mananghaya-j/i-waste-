CREATE TYPE "AnnouncementCategory" AS ENUM (
    'COMMUNITY_EVENT',
    'GREETING',
    'ANNOUNCEMENT',
    'ACTIVITY_SCHEDULE',
    'MEMO',
    'CITY_ORDINANCE',
    'BARANGAY_ORDINANCE',
    'RA_9003'
);

ALTER TABLE "pickup_requests"
    ADD COLUMN "measured_waste_kg" DECIMAL(10,2),
    ADD COLUMN "measured_recyclables_kg" DECIMAL(10,2),
    ADD COLUMN "measured_compost_kg" DECIMAL(10,2),
    ADD COLUMN "completed_at" TIMESTAMPTZ(3);

ALTER TABLE "environmental_reports"
    ADD COLUMN "email" VARCHAR(254),
    ADD COLUMN "assigned_investigator_id" UUID;

ALTER TABLE "announcements"
    ADD COLUMN "category" "AnnouncementCategory" NOT NULL DEFAULT 'ANNOUNCEMENT',
    ADD COLUMN "starts_at" TIMESTAMPTZ(3),
    ADD COLUMN "location" VARCHAR(300);

CREATE TABLE "recyclables_requests" (
    "id" UUID NOT NULL,
    "reference_no" VARCHAR(32) NOT NULL,
    "requester_id" UUID,
    "full_name" VARCHAR(120),
    "contact_number" VARCHAR(24) NOT NULL,
    "material_type" VARCHAR(80) NOT NULL,
    "estimated_weight_kg" DECIMAL(10,2),
    "actual_collected_kg" DECIMAL(10,2),
    "pickup_address" VARCHAR(300) NOT NULL,
    "fulfillment" VARCHAR(16) NOT NULL,
    "preferred_date" DATE NOT NULL,
    "status" "RequestStatus" NOT NULL DEFAULT 'SUBMITTED',
    "admin_notes" VARCHAR(1000),
    "assigned_truck_id" UUID,
    "completed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "recyclables_requests_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "attachments"
    ADD COLUMN "recyclables_request_id" UUID;

CREATE TABLE "event_rsvps" (
    "id" UUID NOT NULL,
    "announcement_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_rsvps_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "recyclables_requests_reference_no_key" ON "recyclables_requests"("reference_no");
CREATE INDEX "recyclables_requests_status_created_at_idx" ON "recyclables_requests"("status", "created_at");
CREATE INDEX "recyclables_requests_completed_at_assigned_truck_id_idx" ON "recyclables_requests"("completed_at", "assigned_truck_id");
CREATE INDEX "recyclables_requests_pickup_address_idx" ON "recyclables_requests"("pickup_address");
CREATE INDEX "attachments_recyclables_request_id_idx" ON "attachments"("recyclables_request_id");
CREATE INDEX "pickup_requests_completed_at_assigned_truck_id_idx" ON "pickup_requests"("completed_at", "assigned_truck_id");
CREATE INDEX "environmental_reports_assigned_investigator_id_status_idx" ON "environmental_reports"("assigned_investigator_id", "status");
CREATE INDEX "announcements_category_starts_at_idx" ON "announcements"("category", "starts_at");
CREATE UNIQUE INDEX "event_rsvps_announcement_id_user_id_key" ON "event_rsvps"("announcement_id", "user_id");
CREATE INDEX "event_rsvps_user_id_created_at_idx" ON "event_rsvps"("user_id", "created_at");

ALTER TABLE "environmental_reports"
    ADD CONSTRAINT "environmental_reports_assigned_investigator_id_fkey"
    FOREIGN KEY ("assigned_investigator_id") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "recyclables_requests"
    ADD CONSTRAINT "recyclables_requests_requester_id_fkey"
    FOREIGN KEY ("requester_id") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "recyclables_requests"
    ADD CONSTRAINT "recyclables_requests_assigned_truck_id_fkey"
    FOREIGN KEY ("assigned_truck_id") REFERENCES "trucks"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "attachments"
    ADD CONSTRAINT "attachments_recyclables_request_id_fkey"
    FOREIGN KEY ("recyclables_request_id") REFERENCES "recyclables_requests"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "event_rsvps"
    ADD CONSTRAINT "event_rsvps_announcement_id_fkey"
    FOREIGN KEY ("announcement_id") REFERENCES "announcements"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "event_rsvps"
    ADD CONSTRAINT "event_rsvps_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
