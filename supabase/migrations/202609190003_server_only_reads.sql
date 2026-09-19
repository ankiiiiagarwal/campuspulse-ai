-- Public responses are filtered by the Next.js API. Direct table reads would
-- expose internal fields such as browser hashes and staff identities.
revoke all on public.issues, public.issue_clusters, public.issue_confirmations,
  public.issue_verifications, public.campus_boundary, public.audit_log,
  public.dept_password_overrides, public.campuspulse_state,
  public.campuspulse_rate_limits from anon, authenticated;
grant all on public.issues, public.issue_clusters, public.issue_confirmations,
  public.issue_verifications, public.campus_boundary, public.audit_log,
  public.dept_password_overrides, public.campuspulse_state,
  public.campuspulse_rate_limits to service_role;
