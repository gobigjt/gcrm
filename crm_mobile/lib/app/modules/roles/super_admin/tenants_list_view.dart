import 'package:flutter/material.dart';

import '../../../routes/app_routes.dart';
import '../../../shared/widgets/role_aware_bottom_nav.dart';

class TenantsListView extends StatelessWidget {
  const TenantsListView({super.key});

  static const _demo = <_Tenant>[
    _Tenant('Acme Corp', 'Premium · 24 users', 'AC', Color(0xFFE6F1FB), Color(0xFF0C447C), 'Active'),
    _Tenant('Ramco Inds', 'Premium · 18 users', 'RI', Color(0xFFE1F5EE), Color(0xFF085041), 'Active'),
    _Tenant('SV Traders', 'Basic · 8 users', 'SV', Color(0xFFFAEEDA), Color(0xFF633806), 'Active'),
    _Tenant('Mehta Infra', 'Basic · 6 users', 'MI', Color(0xFFEEEDFE), Color(0xFF3C3489), 'Dunning'),
    _Tenant('Jain Bros', 'Basic · 4 users', 'JB', Color(0xFFFCEBEB), Color(0xFF791F1F), 'Churned'),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('All tenants (demo)')),
      bottomNavigationBar: const RoleAwareBottomNav(currentRoute: AppRoutes.tenantsList),
      body: ListView(
        padding: const EdgeInsets.all(12),
        children: [
          TextField(
            decoration: const InputDecoration(
              prefixIcon: Icon(Icons.search_rounded),
              hintText: 'Search tenants…',
            ),
            readOnly: true,
            onTap: () {},
          ),
          const SizedBox(height: 10),
          Wrap(
            spacing: 8,
            children: [
              Chip(label: const Text('Active (305)'), backgroundColor: const Color(0xFFE1F5EE)),
              Chip(label: const Text('Dunning (7)'), backgroundColor: const Color(0xFFFAEEDA)),
            ],
          ),
          const SizedBox(height: 8),
          ..._demo.map(
            (t) => ListTile(
              leading: CircleAvatar(
                backgroundColor: t.bg,
                foregroundColor: t.fg,
                child: Text(t.initials, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700)),
              ),
              title: Text(t.name, style: const TextStyle(fontWeight: FontWeight.w600)),
              subtitle: Text(t.sub),
              trailing: Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: t.status == 'Churned'
                      ? const Color(0xFFFCEBEB)
                      : t.status == 'Dunning'
                          ? const Color(0xFFFAEEDA)
                          : const Color(0xFFE1F5EE),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  t.status,
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w700,
                    color: t.status == 'Churned'
                        ? const Color(0xFF791F1F)
                        : t.status == 'Dunning'
                            ? const Color(0xFF633806)
                            : const Color(0xFF085041),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _Tenant {
  const _Tenant(this.name, this.sub, this.initials, this.bg, this.fg, this.status);
  final String name;
  final String sub;
  final String initials;
  final Color bg;
  final Color fg;
  final String status;
}
