-- Inventory management for medical consumables (admin only).
-- The clinic operates with Dr. Bernice Paule (doctor) plus admin/receptionist
-- staff; inventory is an admin-only workspace per docs/DESIGN.md.
CREATE TABLE IF NOT EXISTS public.inventory_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 120),
  category text NOT NULL DEFAULT 'General' CHECK (length(btrim(category)) BETWEEN 1 AND 60),
  unit text NOT NULL DEFAULT 'piece' CHECK (length(btrim(unit)) BETWEEN 1 AND 30),
  current_stock integer NOT NULL DEFAULT 0 CHECK (current_stock >= 0),
  minimum_stock integer NOT NULL DEFAULT 5 CHECK (minimum_stock >= 0),
  location text CHECK (location IS NULL OR length(btrim(location)) <= 120),
  batch_number text CHECK (batch_number IS NULL OR length(btrim(batch_number)) <= 60),
  expiry_date date CHECK (expiry_date IS NULL OR expiry_date >= DATE '2000-01-01'),
  last_updated timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inventory_items_category
  ON public.inventory_items(category);
CREATE INDEX IF NOT EXISTS idx_inventory_items_low_stock
  ON public.inventory_items(current_stock, minimum_stock);

ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;

-- Admin-only access: inventory is an Administration/Operations workspace.
DROP POLICY IF EXISTS inventory_items_admin_all ON public.inventory_items;
CREATE POLICY inventory_items_admin_all
  ON public.inventory_items
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

REVOKE ALL ON TABLE public.inventory_items FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.inventory_items TO authenticated;

-- Every stock movement is a ledger row; item.current_stock is derived from it.
CREATE TABLE IF NOT EXISTS public.stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES public.inventory_items(id) ON DELETE RESTRICT,
  movement_type text NOT NULL CHECK (movement_type IN ('in', 'out', 'adjustment')),
  quantity integer NOT NULL CHECK (quantity > 0),
  used_by text CHECK (used_by IS NULL OR length(btrim(used_by)) <= 120),
  reason text NOT NULL CHECK (length(btrim(reason)) BETWEEN 1 AND 300),
  notes text CHECK (notes IS NULL OR length(btrim(notes)) <= 500),
  stock_after integer NOT NULL CHECK (stock_after >= 0),
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stock_movements_item_created
  ON public.stock_movements(item_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_movements_created
  ON public.stock_movements(created_at DESC);

ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS stock_movements_admin_all ON public.stock_movements;
CREATE POLICY stock_movements_admin_all
  ON public.stock_movements
  TO authenticated
  USING (public.is_admin());

REVOKE ALL ON TABLE public.stock_movements FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.stock_movements TO authenticated;

-- Audit trail on item edits, mirroring the transactions trigger pattern.
CREATE OR REPLACE FUNCTION public.audit_inventory_item_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.audit_logs (user_id, action, table_name, record_id, old_data, new_data)
  VALUES (
    auth.uid(),
    'UPDATE',
    'inventory_items',
    NEW.id,
    jsonb_build_object(
      'name', OLD.name,
      'category', OLD.category,
      'unit', OLD.unit,
      'current_stock', OLD.current_stock,
      'minimum_stock', OLD.minimum_stock,
      'location', OLD.location,
      'batch_number', OLD.batch_number,
      'expiry_date', OLD.expiry_date
    ),
    jsonb_build_object(
      'name', NEW.name,
      'category', NEW.category,
      'unit', NEW.unit,
      'current_stock', NEW.current_stock,
      'minimum_stock', NEW.minimum_stock,
      'location', NEW.location,
      'batch_number', NEW.batch_number,
      'expiry_date', NEW.expiry_date
    )
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_inventory_item_change ON public.inventory_items;
CREATE TRIGGER trg_audit_inventory_item_change
  AFTER UPDATE OF name, category, unit, current_stock, minimum_stock, location, batch_number, expiry_date
  ON public.inventory_items
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_inventory_item_change();

-- Single entry point for stock changes. Admin only. Updates the item,
-- writes a ledger row, and keeps stock_after for the consumption report.
CREATE OR REPLACE FUNCTION public.record_stock_movement(
  p_item_id uuid,
  p_movement_type text,
  p_quantity integer,
  p_reason text,
  p_used_by text DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item public.inventory_items%ROWTYPE;
  v_stock_after integer;
  v_movement_id uuid;
  v_reason text := btrim(coalesce(p_reason, ''));
  v_used_by text := NULLIF(btrim(coalesce(p_used_by, '')), '');
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'Clinic admin access is required to record a stock movement'
      USING ERRCODE = '42501';
  END IF;

  IF p_movement_type NOT IN ('in', 'out', 'adjustment') THEN
    RAISE EXCEPTION 'Movement type must be in, out, or adjustment'
      USING ERRCODE = '22023';
  END IF;
  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'Quantity must be greater than zero'
      USING ERRCODE = '22023';
  END IF;
  IF length(v_reason) = 0 OR length(v_reason) > 300 THEN
    RAISE EXCEPTION 'A reason is required, up to 300 characters'
      USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_item
  FROM public.inventory_items
  WHERE id = p_item_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Inventory item not found'
      USING ERRCODE = 'P0002';
  END IF;

  IF p_movement_type = 'in' THEN
    v_stock_after := v_item.current_stock + p_quantity;
  ELSIF p_movement_type = 'out' THEN
    IF v_item.current_stock < p_quantity THEN
      RAISE EXCEPTION 'Insufficient stock: % available, % requested', v_item.current_stock, p_quantity
        USING ERRCODE = '22023';
    END IF;
    v_stock_after := v_item.current_stock - p_quantity;
  ELSE -- adjustment replaces the counted stock
    v_stock_after := p_quantity;
  END IF;

  UPDATE public.inventory_items
  SET current_stock = v_stock_after,
      last_updated = now()
  WHERE id = p_item_id;

  INSERT INTO public.stock_movements (
    item_id, movement_type, quantity, used_by, reason, notes, stock_after, created_by
  ) VALUES (
    p_item_id, p_movement_type, p_quantity, v_used_by, v_reason,
    NULLIF(btrim(coalesce(p_notes, '')), ''), v_stock_after, auth.uid()
  )
  RETURNING id INTO v_movement_id;

  RETURN v_movement_id;
END;
$$;

-- Admin-only item creation. created_by comes from the signed-in caller, and
-- opening stock above zero is written as the first 'in' ledger row so every
-- stock level stays derivable from stock_movements.
CREATE OR REPLACE FUNCTION public.create_inventory_item(
  p_name text,
  p_category text DEFAULT 'General',
  p_unit text DEFAULT 'piece',
  p_current_stock integer DEFAULT 0,
  p_minimum_stock integer DEFAULT 5,
  p_location text DEFAULT NULL,
  p_batch_number text DEFAULT NULL,
  p_expiry_date date DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name text := btrim(coalesce(p_name, ''));
  v_category text := btrim(coalesce(p_category, 'General'));
  v_unit text := btrim(coalesce(p_unit, 'piece'));
  v_location text := NULLIF(btrim(coalesce(p_location, '')), '');
  v_batch_number text := NULLIF(btrim(coalesce(p_batch_number, '')), '');
  v_item_id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'Clinic admin access is required to add an inventory item'
      USING ERRCODE = '42501';
  END IF;

  IF length(v_name) = 0 OR length(v_name) > 120 THEN
    RAISE EXCEPTION 'Enter an item name, up to 120 characters'
      USING ERRCODE = '22023';
  END IF;
  IF length(v_category) = 0 OR length(v_category) > 60 THEN
    RAISE EXCEPTION 'Enter a category, up to 60 characters'
      USING ERRCODE = '22023';
  END IF;
  IF length(v_unit) = 0 OR length(v_unit) > 30 THEN
    RAISE EXCEPTION 'Enter a unit, up to 30 characters'
      USING ERRCODE = '22023';
  END IF;
  IF p_current_stock IS NULL OR p_current_stock < 0 THEN
    RAISE EXCEPTION 'Current stock must be zero or greater'
      USING ERRCODE = '22023';
  END IF;
  IF p_minimum_stock IS NULL OR p_minimum_stock < 0 THEN
    RAISE EXCEPTION 'Minimum stock must be zero or greater'
      USING ERRCODE = '22023';
  END IF;
  IF v_location IS NOT NULL AND length(v_location) > 120 THEN
    RAISE EXCEPTION 'Location is limited to 120 characters'
      USING ERRCODE = '22023';
  END IF;
  IF v_batch_number IS NOT NULL AND length(v_batch_number) > 60 THEN
    RAISE EXCEPTION 'Batch number is limited to 60 characters'
      USING ERRCODE = '22023';
  END IF;
  IF p_expiry_date IS NOT NULL AND p_expiry_date < DATE '2000-01-01' THEN
    RAISE EXCEPTION 'Expiry date is outside the supported range'
      USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.inventory_items (
    name, category, unit, current_stock, minimum_stock,
    location, batch_number, expiry_date, created_by
  ) VALUES (
    v_name, v_category, v_unit, p_current_stock, p_minimum_stock,
    v_location, v_batch_number, p_expiry_date, auth.uid()
  )
  RETURNING id INTO v_item_id;

  IF p_current_stock > 0 THEN
    INSERT INTO public.stock_movements (
      item_id, movement_type, quantity, reason, stock_after, created_by
    ) VALUES (
      v_item_id, 'in', p_current_stock, 'Initial stock on record', p_current_stock, auth.uid()
    );
  END IF;

  RETURN v_item_id;
END;
$$;

-- Movement history is an append-only ledger: this trigger blocks UPDATE and
-- DELETE for every caller except backend maintenance under the service key
-- (auth.role() = 'service_role'), which automated tests use for cleanup.
CREATE OR REPLACE FUNCTION public.protect_stock_movements()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF auth.role() = 'service_role' THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'Stock movement history can never be updated or deleted'
    USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_stock_movements ON public.stock_movements;
CREATE TRIGGER trg_protect_stock_movements
  BEFORE UPDATE OR DELETE ON public.stock_movements
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_stock_movements();

REVOKE ALL ON FUNCTION public.audit_inventory_item_change() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_stock_movement(uuid, text, integer, text, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_stock_movement(uuid, text, integer, text, text, text)
  TO authenticated;
REVOKE ALL ON FUNCTION public.create_inventory_item(text, text, text, integer, integer, text, text, date)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_inventory_item(text, text, text, integer, integer, text, text, date)
  TO authenticated;
REVOKE ALL ON FUNCTION public.protect_stock_movements() FROM PUBLIC, anon, authenticated;

COMMENT ON TABLE public.inventory_items IS
  'Medical consumables tracked by the clinic admin. current_stock is changed only through record_stock_movement.';
COMMENT ON TABLE public.stock_movements IS
  'Immutable ledger of stock in/out/adjustment events; powers the consumption report.';
