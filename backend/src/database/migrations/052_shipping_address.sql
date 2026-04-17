ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS shipping_address TEXT DEFAULT NULL;
update leads set shipping_address = address where shipping_address is null;