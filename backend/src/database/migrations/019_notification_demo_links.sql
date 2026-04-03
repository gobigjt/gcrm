-- Link demo CRM notifications to a lead for web/mobile deep navigation.
UPDATE notifications n
SET link = '/crm?lead=' || l.id::text
FROM leads l
WHERE n.title = 'New lead: Ravi Kumar'
  AND l.name = 'Ravi Kumar'
  AND l.company = 'South India Traders'
  AND (n.link IS NULL OR n.link = '');
