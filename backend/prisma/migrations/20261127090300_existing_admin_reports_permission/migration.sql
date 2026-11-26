UPDATE "users"
SET "permissions" = array_append("permissions", 'reports:manage')
WHERE "role" = 'ADMIN'
  AND NOT ("permissions" @> ARRAY['reports:manage']::text[]);
