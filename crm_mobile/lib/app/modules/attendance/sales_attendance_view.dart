import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../../routes/app_routes.dart';
import '../../shared/widgets/app_navigation_drawer.dart';
import '../../shared/widgets/role_aware_bottom_nav.dart';
import 'sales_attendance_controller.dart';
import 'sales_executive_attendance_card.dart';

/// Full-screen check-in / check-out for Sales Executive (also reachable from Home).
class SalesAttendanceView extends StatefulWidget {
  const SalesAttendanceView({super.key});

  @override
  State<SalesAttendanceView> createState() => _SalesAttendanceViewState();
}

class _SalesAttendanceViewState extends State<SalesAttendanceView> {
  late final SalesAttendanceController _c = Get.find<SalesAttendanceController>();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _c.refreshTodayAttendance());
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      drawer: const AppNavigationDrawer(currentRoute: AppRoutes.attendance),
      appBar: AppBar(
        title: const Text('Attendance'),
      ),
      body: RefreshIndicator(
        onRefresh: _c.refreshTodayAttendance,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(16),
          children: [
            SalesExecutiveAttendanceCard(controller: _c),
            const SizedBox(height: 16),
            Text(
              'Times use the server clock. Check-in and check-out are stored for your login user (users table), not the HR employee record.',
              style: TextStyle(fontSize: 12, color: Theme.of(context).colorScheme.onSurfaceVariant, height: 1.4),
            ),
          ],
        ),
      ),
      bottomNavigationBar: const RoleAwareBottomNav(currentRoute: AppRoutes.attendance),
    );
  }
}
