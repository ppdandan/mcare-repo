-- Transactions are records of in-person payments after completed services.
-- This migration adds no checkout flow or payment-provider integration.
CREATE TABLE IF NOT EXISTS public.transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  appointment_id uuid NOT NULL UNIQUE REFERENCES public.appointments(id) ON DELETE RESTRICT,
  amount numeric(12, 2) NOT NULL CHECK (amount >= 0),
  currency text NOT NULL DEFAULT 'PHP' CHECK (currency ~ '^[A-Z]{3}$'),
  payment_method text NOT NULL CHECK (length(btrim(payment_method)) BETWEEN 1 AND 40),
  notes text,
  recorded_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  voided_at timestamptz,
  voided_by uuid REFERENCES public.profiles(id) ON DELETE RESTRICT,
  void_reason text,
  CONSTRAINT transactions_void_metadata_consistent CHECK (
    (voided_at IS NULL AND voided_by IS NULL AND void_reason IS NULL)
    OR (
      voided_at IS NOT NULL
      AND voided_by IS NOT NULL
      AND length(btrim(coalesce(void_reason, ''))) > 0
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_transactions_user_created_at
  ON public.transactions(user_id, created_at DESC);

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS transactions_select_policy ON public.transactions;
CREATE POLICY transactions_select_policy
  ON public.transactions FOR SELECT
  TO authenticated
  USING (
    (user_id = auth.uid() AND public.current_user_role() = 'patient')
    OR public.current_user_role() IN ('doctor', 'admin')
  );

-- Patient and staff clients may read through RLS. All writes are done through
-- narrowly scoped SECURITY DEFINER functions below.
REVOKE ALL ON TABLE public.transactions FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.transactions TO authenticated;

CREATE OR REPLACE FUNCTION public.audit_transaction_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.audit_logs (user_id, action, table_name, record_id, old_data, new_data)
  VALUES (
    auth.uid(),
    CASE WHEN NEW.voided_at IS NOT NULL AND OLD.voided_at IS NULL THEN 'VOID' ELSE 'UPDATE' END,
    'transactions',
    NEW.id,
    jsonb_build_object(
      'amount', OLD.amount,
      'currency', OLD.currency,
      'payment_method', OLD.payment_method,
      'notes', OLD.notes,
      'voided_at', OLD.voided_at,
      'voided_by', OLD.voided_by,
      'void_reason', OLD.void_reason
    ),
    jsonb_build_object(
      'amount', NEW.amount,
      'currency', NEW.currency,
      'payment_method', NEW.payment_method,
      'notes', NEW.notes,
      'voided_at', NEW.voided_at,
      'voided_by', NEW.voided_by,
      'void_reason', NEW.void_reason
    )
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_transaction_change ON public.transactions;
CREATE TRIGGER trg_audit_transaction_change
  AFTER UPDATE OF amount, currency, payment_method, notes, voided_at, voided_by, void_reason
  ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_transaction_change();

CREATE OR REPLACE FUNCTION public.record_appointment_transaction(
  p_appointment_id uuid,
  p_amount numeric,
  p_payment_method text,
  p_currency text DEFAULT 'PHP',
  p_notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role public.user_role;
  v_patient_profile_id uuid;
  v_appointment_doctor_id uuid;
  v_appointment_status public.appointment_status;
  v_transaction_id uuid;
  v_currency text := upper(btrim(coalesce(p_currency, 'PHP')));
  v_payment_method text := btrim(coalesce(p_payment_method, ''));
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in is required to record a transaction'
      USING ERRCODE = '42501';
  END IF;

  SELECT p.role INTO v_role
  FROM public.profiles AS p
  WHERE p.id = auth.uid();

  IF v_role IS NULL OR v_role NOT IN ('doctor', 'admin') THEN
    RAISE EXCEPTION 'Doctor or clinic admin access is required to record a transaction'
      USING ERRCODE = '42501';
  END IF;

  IF p_amount IS NULL OR p_amount < 0 THEN
    RAISE EXCEPTION 'Amount must be zero or greater'
      USING ERRCODE = '22023';
  END IF;
  IF v_payment_method = '' OR length(v_payment_method) > 40 THEN
    RAISE EXCEPTION 'Enter a payment method label, up to 40 characters'
      USING ERRCODE = '22023';
  END IF;
  IF v_currency !~ '^[A-Z]{3}$' THEN
    RAISE EXCEPTION 'Currency must be a three-letter code'
      USING ERRCODE = '22023';
  END IF;

  SELECT a.status, a.doctor_id, pa.profile_id
    INTO v_appointment_status, v_appointment_doctor_id, v_patient_profile_id
  FROM public.appointments AS a
  JOIN public.patients AS pa ON pa.id = a.patient_id
  WHERE a.id = p_appointment_id
  FOR UPDATE OF a;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Appointment not found'
      USING ERRCODE = 'P0002';
  END IF;
  IF v_appointment_status <> 'completed' THEN
    RAISE EXCEPTION 'A transaction can only be recorded for a completed appointment'
      USING ERRCODE = '22023';
  END IF;
  IF v_role = 'doctor' AND public.current_doctor_id() IS DISTINCT FROM v_appointment_doctor_id THEN
    RAISE EXCEPTION 'Doctors may record transactions only for their own appointments'
      USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.transactions (
    user_id, appointment_id, amount, currency, payment_method, notes, recorded_by
  ) VALUES (
    v_patient_profile_id,
    p_appointment_id,
    p_amount,
    v_currency,
    v_payment_method,
    NULLIF(btrim(p_notes), ''),
    auth.uid()
  )
  RETURNING id INTO v_transaction_id;

  RETURN v_transaction_id;
EXCEPTION WHEN unique_violation THEN
  RAISE EXCEPTION 'A transaction is already recorded for this appointment'
    USING ERRCODE = '23505';
END;
$$;

CREATE OR REPLACE FUNCTION public.correct_appointment_transaction(
  p_transaction_id uuid,
  p_amount numeric,
  p_payment_method text,
  p_currency text DEFAULT 'PHP',
  p_notes text DEFAULT NULL,
  p_reason text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_currency text := upper(btrim(coalesce(p_currency, 'PHP')));
  v_payment_method text := btrim(coalesce(p_payment_method, ''));
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'Clinic admin access is required to correct a transaction'
      USING ERRCODE = '42501';
  END IF;
  IF p_amount IS NULL OR p_amount < 0 OR v_payment_method = ''
     OR length(v_payment_method) > 40 OR v_currency !~ '^[A-Z]{3}$'
     OR length(btrim(coalesce(p_reason, ''))) = 0 THEN
    RAISE EXCEPTION 'Provide a valid amount, payment method, currency, and correction reason'
      USING ERRCODE = '22023';
  END IF;

  UPDATE public.transactions
  SET amount = p_amount,
      currency = v_currency,
      payment_method = v_payment_method,
      notes = NULLIF(btrim(p_notes), '')
  WHERE id = p_transaction_id AND voided_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Active transaction not found'
      USING ERRCODE = 'P0002';
  END IF;

  -- Keep the reason alongside the immutable old/new values in audit_logs.
  UPDATE public.audit_logs
  SET new_data = new_data || jsonb_build_object('correction_reason', btrim(p_reason))
  WHERE id = (
    SELECT al.id
    FROM public.audit_logs AS al
    WHERE al.table_name = 'transactions'
      AND al.action = 'UPDATE'
      AND al.record_id = p_transaction_id
      AND al.user_id = auth.uid()
    ORDER BY al.created_at DESC, al.id DESC
    LIMIT 1
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.void_appointment_transaction(
  p_transaction_id uuid,
  p_reason text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'Clinic admin access is required to void a transaction'
      USING ERRCODE = '42501';
  END IF;
  IF length(btrim(coalesce(p_reason, ''))) = 0 THEN
    RAISE EXCEPTION 'A reason is required to void a transaction'
      USING ERRCODE = '22023';
  END IF;

  UPDATE public.transactions
  SET voided_at = now(),
      voided_by = auth.uid(),
      void_reason = btrim(p_reason)
  WHERE id = p_transaction_id AND voided_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Active transaction not found'
      USING ERRCODE = 'P0002';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.audit_transaction_change() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_appointment_transaction(uuid, numeric, text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.correct_appointment_transaction(uuid, numeric, text, text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.void_appointment_transaction(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_appointment_transaction(uuid, numeric, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.correct_appointment_transaction(uuid, numeric, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.void_appointment_transaction(uuid, text) TO authenticated;
