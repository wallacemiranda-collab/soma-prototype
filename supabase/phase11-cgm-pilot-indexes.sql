-- Supporting indexes for the CGM pilot's foreign keys.
create index patient_cgm_imports_patient_source_idx
  on public.patient_cgm_imports (patient_id, source_key);
create index patient_cgm_readings_import_owner_consent_idx
  on public.patient_cgm_readings (import_id, patient_id, consent_request_id);
create index patient_cgm_access_logs_doctor_idx
  on public.patient_cgm_access_logs (doctor_id);
