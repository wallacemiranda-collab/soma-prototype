create index if not exists patient_cgm_pdf_access_logs_actor_time_idx
  on public.patient_cgm_pdf_access_logs (actor_id, accessed_at desc, id desc);
create index if not exists patient_cgm_pdf_access_logs_report_idx
  on public.patient_cgm_pdf_access_logs (report_id) where report_id is not null;
