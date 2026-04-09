-- Optional demo employee for HR/payroll (attendance uses users.id after migration 023).
INSERT INTO employees (user_id, employee_code, department, designation, date_of_joining, basic_salary)
SELECT u.id, 'DEMO-SE-001', 'Sales', 'Sales Executive', CURRENT_DATE - INTERVAL '400 days', 42000
FROM users u
WHERE u.email = 'demo.sales.executive@example.com'
  AND NOT EXISTS (SELECT 1 FROM employees e WHERE e.user_id = u.id);
