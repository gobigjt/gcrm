import 'package:flutter/material.dart';

import '../../../routes/app_routes.dart';
import '../../../shared/widgets/app_navigation_drawer.dart';
import '../../../shared/widgets/role_aware_bottom_nav.dart';

class SaasBillingView extends StatelessWidget {
  const SaasBillingView({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      drawer: const AppNavigationDrawer(currentRoute: AppRoutes.saasBilling),
      appBar: AppBar(title: const Text('SaaS billing (demo)')),
      bottomNavigationBar: const RoleAwareBottomNav(currentRoute: AppRoutes.saasBilling),
      body: ListView(
        padding: const EdgeInsets.all(12),
        children: [
          Row(
            children: [
              Expanded(
                child: Card(
                  child: Padding(
                    padding: const EdgeInsets.all(12),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('MRR', style: TextStyle(color: Theme.of(context).hintColor, fontSize: 12)),
                        const Text('₹4.82L', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
                        const Text('+11%', style: TextStyle(color: Color(0xFF27500A), fontSize: 12)),
                      ],
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Card(
                  child: Padding(
                    padding: const EdgeInsets.all(12),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('ARR', style: TextStyle(color: Theme.of(context).hintColor, fontSize: 12)),
                        const Text('₹57.8L', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
                      ],
                    ),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          Text(
            'FAILED PAYMENTS (demo)',
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  fontWeight: FontWeight.w700,
                  letterSpacing: 0.4,
                  color: Theme.of(context).hintColor,
                ),
          ),
          ListTile(
            title: const Text('Mehta Infra — Retry 2/3'),
            subtitle: const Text('Basic · ₹1,499'),
            trailing: Chip(label: const Text('Retrying'), backgroundColor: const Color(0xFFFAEEDA)),
          ),
          ListTile(
            title: const Text('ABS Corp — Retry 1/3'),
            subtitle: const Text('Basic · ₹1,499'),
            trailing: Chip(label: const Text('Retrying'), backgroundColor: const Color(0xFFFAEEDA)),
          ),
          ListTile(
            title: const Text('Sunrise Pvt — Retry 3/3'),
            subtitle: const Text('Basic · ₹1,499'),
            trailing: Chip(label: const Text('Final'), backgroundColor: const Color(0xFFFCEBEB)),
          ),
        ],
      ),
    );
  }
}
