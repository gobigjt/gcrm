-- Profile photo for users (served under /uploads/users/)

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(500);
