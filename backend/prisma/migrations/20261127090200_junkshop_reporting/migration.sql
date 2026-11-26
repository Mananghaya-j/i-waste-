CREATE TABLE "junkshops" (
    "id" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "accreditation_number" VARCHAR(80) NOT NULL,
    "address" VARCHAR(300) NOT NULL,
    "contact_person" VARCHAR(120),
    "contact_number" VARCHAR(24),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "junkshops_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "junkshop_monthly_reports" (
    "id" UUID NOT NULL,
    "reference_no" VARCHAR(32) NOT NULL,
    "junkshop_id" UUID NOT NULL,
    "report_month" DATE NOT NULL,
    "truck_id" UUID,
    "household_address" VARCHAR(300),
    "notes" VARCHAR(1000),
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "junkshop_monthly_reports_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "junkshop_material_entries" (
    "id" UUID NOT NULL,
    "report_id" UUID NOT NULL,
    "category" VARCHAR(40) NOT NULL,
    "other_material" VARCHAR(80),
    "quantity" DECIMAL(10,2) NOT NULL,
    "unit" VARCHAR(20) NOT NULL,
    "other_unit" VARCHAR(20),
    "weight_kg" DECIMAL(10,2) NOT NULL,
    "volume_m3" DECIMAL(10,3) NOT NULL,

    CONSTRAINT "junkshop_material_entries_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "attachments"
    ADD COLUMN "junkshop_report_id" UUID;

CREATE UNIQUE INDEX "junkshops_accreditation_number_key" ON "junkshops"("accreditation_number");
CREATE INDEX "junkshops_name_idx" ON "junkshops"("name");
CREATE INDEX "junkshops_is_active_idx" ON "junkshops"("is_active");
CREATE UNIQUE INDEX "junkshop_monthly_reports_reference_no_key" ON "junkshop_monthly_reports"("reference_no");
CREATE INDEX "junkshop_monthly_reports_report_month_truck_id_idx" ON "junkshop_monthly_reports"("report_month", "truck_id");
CREATE INDEX "junkshop_monthly_reports_junkshop_id_report_month_idx" ON "junkshop_monthly_reports"("junkshop_id", "report_month");
CREATE INDEX "junkshop_monthly_reports_household_address_idx" ON "junkshop_monthly_reports"("household_address");
CREATE INDEX "junkshop_material_entries_report_id_category_idx" ON "junkshop_material_entries"("report_id", "category");
CREATE INDEX "attachments_junkshop_report_id_idx" ON "attachments"("junkshop_report_id");

ALTER TABLE "junkshop_monthly_reports"
    ADD CONSTRAINT "junkshop_monthly_reports_junkshop_id_fkey"
    FOREIGN KEY ("junkshop_id") REFERENCES "junkshops"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "junkshop_monthly_reports"
    ADD CONSTRAINT "junkshop_monthly_reports_truck_id_fkey"
    FOREIGN KEY ("truck_id") REFERENCES "trucks"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "junkshop_monthly_reports"
    ADD CONSTRAINT "junkshop_monthly_reports_created_by_id_fkey"
    FOREIGN KEY ("created_by_id") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "junkshop_material_entries"
    ADD CONSTRAINT "junkshop_material_entries_report_id_fkey"
    FOREIGN KEY ("report_id") REFERENCES "junkshop_monthly_reports"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "attachments"
    ADD CONSTRAINT "attachments_junkshop_report_id_fkey"
    FOREIGN KEY ("junkshop_report_id") REFERENCES "junkshop_monthly_reports"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
