-- APOIS Corridas: stage-2 activation for new-car 13-photo gate, NOT APPLIED.
-- DO NOT APPLY until Motorista/Admin build with 13-photo signup, review and pendency handling
-- has been physically tested and distributed. Legacy approved drivers remain untouched.
-- Requires applied stage-1 migration 20261031173347.
DO $$
BEGIN
 IF to_regclass('public.apois_vehicle_inspection_photos') IS NULL
    OR to_regclass('public.apois_driver_correction_requests') IS NULL
    OR to_regprocedure('public.apois_admin_request_driver_correction(uuid,text[],text)') IS NULL THEN
    RAISE EXCEPTION 'apois_stage1_prerequisite_missing';
 END IF;
 IF EXISTS(SELECT 1 FROM public.drivers
   WHERE category='carros' AND approval_status IN ('pendente','em_analise','reprovado')
   AND (vehicle_year IS NULL OR vehicle_year<extract(year FROM current_date)::int-10)) THEN
   RAISE EXCEPTION 'preexisting_car_applications_require_manual_age_review';
 END IF;
END; $$;
-- Capture a revision when an existing document is replaced.
DROP TRIGGER IF EXISTS apois_snapshot_front_on_vehicle_change ON public.drivers;
CREATE TRIGGER apois_snapshot_front_on_vehicle_change
AFTER INSERT OR UPDATE OF vehicle_photo_url ON public.drivers
FOR EACH ROW EXECUTE FUNCTION private.apois_snapshot_front_on_document_change();

-- Blocks approval of new cars until latest 13 photos reviewed and year <=10.
DROP TRIGGER IF EXISTS apois_require_vehicle_inspection_on_driver ON public.drivers;
CREATE TRIGGER apois_require_vehicle_inspection_on_driver
BEFORE INSERT OR UPDATE OF approval_status,category,vehicle_photo_url ON public.drivers
FOR EACH ROW EXECUTE FUNCTION private.apois_require_vehicle_inspection();

-- Preserve administrative pendencies until driver has resubmitted.
DROP TRIGGER IF EXISTS apois_prevent_approval_during_corrections ON public.drivers;
CREATE TRIGGER apois_prevent_approval_during_corrections
BEFORE UPDATE OF approval_status ON public.drivers
FOR EACH ROW EXECUTE FUNCTION private.apois_prevent_approval_during_corrections();
