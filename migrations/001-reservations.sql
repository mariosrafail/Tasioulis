CREATE TABLE IF NOT EXISTS reservations (
  id uuid PRIMARY KEY,
  property text NOT NULL CHECK (property IN ('SkouZen', 'Ivory', 'Pearl')),
  checkin date NOT NULL,
  checkout date NOT NULL CHECK (checkout > checkin),
  kind text NOT NULL CHECK (kind IN ('request', 'phone', 'block')),
  status text NOT NULL CHECK (status IN ('pending', 'confirmed', 'cancelled')),
  guest_name text NOT NULL DEFAULT '',
  guest_email text NOT NULL DEFAULT '',
  guests integer CHECK (guests BETWEEN 1 AND 4),
  note text NOT NULL DEFAULT '',
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, property)
);
-- One row per occupied NIGHT. Departure day remains available for the next arrival.
-- This primary key arbitrates simultaneous online / telephone bookings atomically.
CREATE TABLE IF NOT EXISTS occupied_nights (
  property text NOT NULL,
  stay_date date NOT NULL,
  reservation_id uuid NOT NULL,
  PRIMARY KEY (property, stay_date),
  FOREIGN KEY (reservation_id, property) REFERENCES reservations(id, property)
);
CREATE INDEX IF NOT EXISTS occupied_nights_reservation_idx ON occupied_nights(reservation_id);
CREATE INDEX IF NOT EXISTS reservations_dates_idx ON reservations(checkin, checkout);
CREATE TABLE IF NOT EXISTS reservation_audit (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  reservation_id uuid NOT NULL REFERENCES reservations(id),
  action text NOT NULL,
  actor text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
