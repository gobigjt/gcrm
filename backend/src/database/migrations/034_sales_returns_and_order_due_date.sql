-- Sale returns (credit notes) + order due date — parity with jeg CRM sales module

ALTER TABLE sales_orders
  ADD COLUMN IF NOT EXISTS due_date DATE;

CREATE TABLE IF NOT EXISTS sale_returns (
  id              SERIAL PRIMARY KEY,
  return_number   VARCHAR(50)   UNIQUE NOT NULL,
  customer_id     INTEGER       NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  reference_no    VARCHAR(100),
  return_date     DATE          NOT NULL DEFAULT CURRENT_DATE,
  state_of_supply VARCHAR(50),
  exchange_rate   NUMERIC(10,4) NOT NULL DEFAULT 1,
  notes           TEXT,
  subtotal        NUMERIC(15,2) NOT NULL DEFAULT 0,
  cgst            NUMERIC(15,2) NOT NULL DEFAULT 0,
  sgst            NUMERIC(15,2) NOT NULL DEFAULT 0,
  igst            NUMERIC(15,2) NOT NULL DEFAULT 0,
  discount_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  round_off       NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_amount    NUMERIC(15,2) NOT NULL DEFAULT 0,
  paid_amount     NUMERIC(15,2) NOT NULL DEFAULT 0,
  created_by      INTEGER       REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sale_return_items (
  id          SERIAL PRIMARY KEY,
  return_id   INTEGER       NOT NULL REFERENCES sale_returns(id) ON DELETE CASCADE,
  product_id  INTEGER       REFERENCES products(id) ON DELETE SET NULL,
  description TEXT          NOT NULL,
  quantity    NUMERIC(15,3) NOT NULL,
  unit_price  NUMERIC(15,2) NOT NULL,
  discount    NUMERIC(10,2) NOT NULL DEFAULT 0,
  gst_rate    NUMERIC(5,2)  NOT NULL DEFAULT 0,
  total       NUMERIC(15,2) NOT NULL
);

CREATE TABLE IF NOT EXISTS sale_return_payments (
  id           SERIAL PRIMARY KEY,
  return_id    INTEGER       NOT NULL REFERENCES sale_returns(id) ON DELETE RESTRICT,
  amount       NUMERIC(15,2) NOT NULL,
  payment_date DATE          NOT NULL DEFAULT CURRENT_DATE,
  method       VARCHAR(50)   NOT NULL DEFAULT 'bank_transfer',
  reference    VARCHAR(200),
  notes        TEXT,
  created_by   INTEGER       REFERENCES users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
