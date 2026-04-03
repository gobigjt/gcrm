class DashboardStats {
  DashboardStats({
    required this.openLeads,
    required this.revenue,
    required this.activeOrders,
    required this.totalEmployees,
    this.openLeadsNew7d = 0,
    this.overdueInvoices = 0,
    this.activeUsers = 0,
  });

  final int openLeads;
  final double revenue;
  final int activeOrders;
  final int totalEmployees;
  /// Open (non-converted) leads created in the last 7 days.
  final int openLeadsNew7d;
  final int overdueInvoices;
  final int activeUsers;

  factory DashboardStats.fromJson(Map<String, dynamic> json) {
    return DashboardStats(
      openLeads: (json['open_leads'] as num? ?? 0).toInt(),
      revenue: (json['revenue'] as num? ?? 0).toDouble(),
      activeOrders: (json['active_orders'] as num? ?? 0).toInt(),
      totalEmployees: (json['total_employees'] as num? ?? 0).toInt(),
      openLeadsNew7d: (json['open_leads_new_7d'] as num? ?? 0).toInt(),
      overdueInvoices: (json['overdue_invoices'] as num? ?? 0).toInt(),
      activeUsers: (json['active_users'] as num? ?? 0).toInt(),
    );
  }
}
