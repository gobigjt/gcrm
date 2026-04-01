class DashboardStats {
  DashboardStats({
    required this.openLeads,
    required this.revenue,
    required this.activeOrders,
    required this.totalEmployees,
  });

  final int openLeads;
  final double revenue;
  final int activeOrders;
  final int totalEmployees;

  factory DashboardStats.fromJson(Map<String, dynamic> json) {
    return DashboardStats(
      openLeads: (json['open_leads'] as num? ?? 0).toInt(),
      revenue: (json['revenue'] as num? ?? 0).toDouble(),
      activeOrders: (json['active_orders'] as num? ?? 0).toInt(),
      totalEmployees: (json['total_employees'] as num? ?? 0).toInt(),
    );
  }
}
