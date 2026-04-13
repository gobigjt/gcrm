import '../utils/ui_format.dart';

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
      openLeads: parseDynamicInt(json['open_leads']),
      revenue: parseDynamicNum(json['revenue']).toDouble(),
      activeOrders: parseDynamicInt(json['active_orders']),
      totalEmployees: parseDynamicInt(json['total_employees']),
      openLeadsNew7d: parseDynamicInt(json['open_leads_new_7d']),
      overdueInvoices: parseDynamicInt(json['overdue_invoices']),
      activeUsers: parseDynamicInt(json['active_users']),
    );
  }
}
