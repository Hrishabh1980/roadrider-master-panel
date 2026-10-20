-- ==============================================================================
-- ROADRIDER MIGRATION 20261019: RIDER APPROVAL & OPERATIONAL ENFORCEMENT
-- ==============================================================================
-- 1. Ensure public.partners has rejection_reason and review metadata columns.
-- 2. Define public.protect_partner_approval_status() trigger:
--    - Restricts approval/rejection/activation strictly to authorized Master Admins.
--    - Enforces that unapproved or suspended riders CANNOT set status = 'online'.
-- 3. Controlled Atomic RPC Functions:
--    - public.admin_approve_partner(p_partner_id uuid)
--    - public.admin_reject_partner(p_partner_id uuid, p_rejection_reason text)
-- ==============================================================================

-- 1. Ensure partners table has rejection_reason column
ALTER TABLE public.partners 
  ADD COLUMN IF NOT EXISTS rejection_reason text;

ALTER TABLE public.partners
  ADD COLUMN IF NOT EXISTS verified_at timestamptz;

ALTER TABLE public.partners
  ADD COLUMN IF NOT EXISTS verified_by uuid;

-- 2. Security Trigger: Enforce approval before riders can go online or manipulate status
CREATE OR REPLACE FUNCTION public.protect_partner_approval_status()
RETURNS TRIGGER AS $$
BEGIN
  -- Restrict transitions to 'verified', 'approved', or 'rejected' strictly to Master Admin
  IF (NEW.kyc_status IN ('verified', 'approved', 'rejected'))
     AND (OLD.kyc_status IS DISTINCT FROM NEW.kyc_status) THEN
    IF NOT public.is_master_admin() THEN
      RAISE EXCEPTION 'Unauthorized: Only an authorized Master Admin can approve or reject rider onboarding applications.';
    END IF;
  END IF;

  -- Restrict activation strictly to Master Admin
  IF (NEW.is_active IS TRUE) AND (OLD.is_active IS NOT TRUE) THEN
    IF NOT public.is_master_admin() THEN
      RAISE EXCEPTION 'Unauthorized: Only an authorized Master Admin can activate a rider account.';
    END IF;
  END IF;

  -- Enforce: UNAPPROVED OR SUSPENDED RIDERS CANNOT GO ONLINE
  IF (NEW.status = 'online' OR NEW.status = 'busy') AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    IF (NEW.is_active IS NOT TRUE) OR (NEW.kyc_status NOT IN ('verified', 'approved')) THEN
      RAISE EXCEPTION 'Unauthorized: Rider account must be approved by administration before going online.';
    END IF;
    IF (OLD.status = 'suspended') AND NOT public.is_master_admin() THEN
      RAISE EXCEPTION 'Unauthorized: Suspended riders cannot go online without administrative reinstatement.';
    END IF;
  END IF;

  -- Restrict modification of rejection_reason strictly to Master Admin
  IF NEW.rejection_reason IS DISTINCT FROM OLD.rejection_reason THEN
    IF NOT public.is_master_admin() THEN
      RAISE EXCEPTION 'Unauthorized: Only an authorized Master Admin can record or update application rejection reasons.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_protect_partner_approval_status ON public.partners;
CREATE TRIGGER trg_protect_partner_approval_status
  BEFORE UPDATE ON public.partners
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_partner_approval_status();

-- 3. Atomic Admin RPC to Approve Partner Application
CREATE OR REPLACE FUNCTION public.admin_approve_partner(p_partner_id uuid)
RETURNS jsonb AS $$
DECLARE
  v_partner record;
  v_unverified_docs integer;
BEGIN
  -- Strict Admin check
  IF NOT public.is_master_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Master Admin privileges required to approve rider applications.';
  END IF;

  -- Verify partner exists
  SELECT * INTO v_partner FROM public.partners WHERE id = p_partner_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Partner record % not found.', p_partner_id;
  END IF;

  -- Ensure at least 1 document has been submitted
  DECLARE
    v_total_docs integer;
  BEGIN
    SELECT count(*) INTO v_total_docs
    FROM public.kyc_documents
    WHERE partner_id = p_partner_id;

    IF v_total_docs = 0 THEN
      RAISE EXCEPTION 'Cannot approve rider: No KYC documents have been submitted.';
    END IF;
  END;

  -- Verify all uploaded required documents are in 'verified' status
  SELECT count(*) INTO v_unverified_docs
  FROM public.kyc_documents
  WHERE partner_id = p_partner_id AND status != 'verified';

  IF v_unverified_docs > 0 THEN
    RAISE EXCEPTION 'Cannot approve rider: % document(s) are still pending or rejected.', v_unverified_docs;
  END IF;

  -- Update partner record to approved & active
  UPDATE public.partners
  SET
    kyc_status = 'verified',
    is_active = true,
    status = 'offline', -- Approved, eligible to go online when they choose
    rejection_reason = NULL,
    verified_at = NOW(),
    verified_by = auth.uid(),
    updated_at = NOW()
  WHERE id = p_partner_id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Rider application approved successfully.',
    'partner_id', p_partner_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Atomic Admin RPC to Reject Partner Application
CREATE OR REPLACE FUNCTION public.admin_reject_partner(p_partner_id uuid, p_rejection_reason text)
RETURNS jsonb AS $$
DECLARE
  v_partner record;
BEGIN
  -- Strict Admin check
  IF NOT public.is_master_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Master Admin privileges required to reject rider applications.';
  END IF;

  IF p_rejection_reason IS NULL OR trim(p_rejection_reason) = '' THEN
    RAISE EXCEPTION 'Rejection reason is mandatory.';
  END IF;

  SELECT * INTO v_partner FROM public.partners WHERE id = p_partner_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Partner record % not found.', p_partner_id;
  END IF;

  -- Update partner record to rejected
  UPDATE public.partners
  SET
    kyc_status = 'rejected',
    is_active = false,
    status = 'offline',
    rejection_reason = trim(p_rejection_reason),
    updated_at = NOW()
  WHERE id = p_partner_id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Rider application rejected.',
    'partner_id', p_partner_id,
    'reason', trim(p_rejection_reason)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.admin_approve_partner(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reject_partner(uuid, text) TO authenticated;

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
