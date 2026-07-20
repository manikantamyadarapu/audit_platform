-- Manual migration to preserve user roles when migrating from role_id to role enum
-- This should be run BEFORE the schema migration that drops the role_id column

-- First, let's see the current users and their roles
SELECT u.id, u.name, u.email, r.role_name 
FROM users u 
JOIN roles r ON u.role_id = r.id;

-- Update users to set their role based on their existing role_id
-- Map role names to the new enum values
UPDATE users 
SET role = CASE 
    WHEN (SELECT role_name FROM roles WHERE id = users.role_id) = 'ADMIN' THEN 'ADMIN'::UserRole
    WHEN (SELECT role_name FROM roles WHERE id = users.role_id) = 'AUDITOR' THEN 'AUDITOR'::UserRole
    WHEN (SELECT role_name FROM roles WHERE id = users.role_id) = 'VIEWER' THEN 'VIEWER'::UserRole
    ELSE 'VIEWER'::UserRole -- default fallback
END;

-- Verify the migration
SELECT id, name, email, role FROM users;
