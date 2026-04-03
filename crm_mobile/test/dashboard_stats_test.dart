import 'package:flutter_test/flutter_test.dart';

import 'package:ezcrm/app/core/models/dashboard_stats.dart';

void main() {
  test('DashboardStats parses extended dashboard payload', () {
    final s = DashboardStats.fromJson({
      'open_leads': 10,
      'revenue': 125000.5,
      'active_orders': 3,
      'total_employees': 7,
      'open_leads_new_7d': 2,
      'overdue_invoices': 4,
      'active_users': 12,
    });
    expect(s.openLeads, 10);
    expect(s.revenue, 125000.5);
    expect(s.openLeadsNew7d, 2);
    expect(s.overdueInvoices, 4);
    expect(s.activeUsers, 12);
  });

  test('DashboardStats tolerates legacy payloads', () {
    final s = DashboardStats.fromJson({
      'open_leads': 1,
      'revenue': 0,
      'active_orders': 0,
      'total_employees': 0,
    });
    expect(s.openLeadsNew7d, 0);
    expect(s.overdueInvoices, 0);
    expect(s.activeUsers, 0);
  });
}
