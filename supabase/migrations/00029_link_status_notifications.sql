-- Link appointment status notifications to their appointment for authorized push dispatch.
CREATE OR REPLACE FUNCTION public.notify_appointment_status_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user_id uuid;
  v_doctor text;
  v_service text;
  v_title text;
  v_body text;
  v_action text;
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status IS NOT DISTINCT FROM NEW.status THEN RETURN NEW; END IF;
  SELECT profile_id INTO v_user_id FROM public.patients WHERE id = NEW.patient_id;
  IF v_user_id IS NULL THEN RETURN NEW; END IF;
  SELECT p.full_name INTO v_doctor FROM public.doctors d JOIN public.profiles p ON p.id = d.profile_id WHERE d.id = NEW.doctor_id;
  SELECT name INTO v_service FROM public.services WHERE id = NEW.service_id;
  v_action := coalesce(current_setting('mcare.appointment_action', true), '');

  IF TG_OP = 'INSERT' AND NEW.status = 'pending' THEN
    v_title := 'Appointment Pending Approval';
    v_body := format('Your %s appointment request with %s for %s is pending clinic approval.', coalesce(v_service, 'visit'), coalesce(v_doctor, 'the doctor'), to_char(NEW.start_time AT TIME ZONE 'Asia/Manila', 'Mon DD, YYYY at HH12:MI AM'));
  ELSE
    CASE NEW.status
      WHEN 'approved' THEN
        v_title := 'Appointment Approved';
        v_body := format('Your %s appointment with %s for %s has been approved.', coalesce(v_service, 'visit'), coalesce(v_doctor, 'the doctor'), to_char(NEW.start_time AT TIME ZONE 'Asia/Manila', 'Mon DD, YYYY at HH12:MI AM'));
      WHEN 'rescheduled' THEN
        v_title := 'Appointment Rescheduled';
        v_body := format('Your %s appointment with %s has been rescheduled to %s.', coalesce(v_service, 'visit'), coalesce(v_doctor, 'the doctor'), to_char(NEW.start_time AT TIME ZONE 'Asia/Manila', 'Mon DD, YYYY at HH12:MI AM'));
      WHEN 'cancelled' THEN
        IF v_action = 'decline' THEN
          v_title := 'Appointment Request Declined';
          v_body := format('Your %s appointment request for %s was declined. Reason: %s', coalesce(v_service, 'visit'), to_char(NEW.start_time AT TIME ZONE 'Asia/Manila', 'Mon DD, YYYY at HH12:MI AM'), coalesce(NEW.cancellation_reason, 'Please contact the clinic for details.'));
        ELSE
          v_title := 'Appointment Cancelled';
          v_body := format('Your %s appointment for %s has been cancelled. Reason: %s', coalesce(v_service, 'visit'), to_char(NEW.start_time AT TIME ZONE 'Asia/Manila', 'Mon DD, YYYY at HH12:MI AM'), coalesce(NEW.cancellation_reason, 'Please contact the clinic for details.'));
        END IF;
      WHEN 'completed' THEN
        v_title := 'Appointment Completed';
        v_body := format('Your consultation record for %s is ready to view in the M-Care mobile app.', coalesce(v_service, 'your visit'));
      ELSE
        v_title := 'Appointment Update';
        v_body := format('The status of your appointment for %s is now %s.', to_char(NEW.start_time AT TIME ZONE 'Asia/Manila', 'Mon DD, YYYY'), NEW.status);
    END CASE;
  END IF;

  INSERT INTO public.notifications (user_id, appointment_id, title, body, is_read, created_at)
  VALUES (v_user_id, NEW.id, v_title, v_body, false, now());
  RETURN NEW;
END;
$$;
