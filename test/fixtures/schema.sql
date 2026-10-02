-- billing
CREATE TABLE plans (id uuid PRIMARY KEY, name text NOT NULL, price_cents int);
CREATE TABLE accounts (
  id uuid PRIMARY KEY,
  plan_id uuid REFERENCES plans(id),
  email varchar(255) UNIQUE,
  created_at timestamptz DEFAULT now()
);
CREATE TABLE invoices (
  id uuid,
  account_id uuid NOT NULL,
  total_cents numeric(12,2),
  PRIMARY KEY (id),
  FOREIGN KEY (account_id) REFERENCES accounts(id)
);
