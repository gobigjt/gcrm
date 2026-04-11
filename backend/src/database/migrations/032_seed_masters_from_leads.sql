-- ============================================================
-- Migration 032 — Seed CRM master tables from existing lead data
-- ============================================================

-- Segments: pull distinct non-empty lead_segment values from leads
INSERT INTO crm_segments (name)
SELECT DISTINCT TRIM(lead_segment)
FROM leads
WHERE lead_segment IS NOT NULL AND TRIM(lead_segment) <> ''
ON CONFLICT (name) DO NOTHING;

-- Priorities: seed from distinct priority values on leads (capitalised)
INSERT INTO crm_priorities (name, color)
SELECT
  INITCAP(priority) AS name,
  CASE priority
    WHEN 'hot'  THEN 'red'
    WHEN 'warm' THEN 'amber'
    WHEN 'cold' THEN 'blue'
    ELSE NULL
  END AS color
FROM (SELECT DISTINCT priority FROM leads WHERE priority IS NOT NULL) p
ON CONFLICT (name) DO NOTHING;

-- Sources: lead_sources already contains the canonical list — nothing to do.
