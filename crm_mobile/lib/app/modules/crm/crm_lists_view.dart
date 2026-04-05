import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../../routes/app_routes.dart';
import '../../shared/widgets/role_aware_bottom_nav.dart';
import '../../shared/widgets/app_navigation_drawer.dart';
import '../auth/auth_controller.dart';
import 'crm_controller.dart';

/// “All lists” — lead sources with counts (reference CRM UI).
class CrmListsView extends StatefulWidget {
  const CrmListsView({super.key});

  @override
  State<CrmListsView> createState() => _CrmListsViewState();
}

class _CrmListsViewState extends State<CrmListsView> {
  final _auth = Get.find<AuthController>();
  bool _loading = true;
  String? _error;
  int _total = 0;
  List<Map<String, dynamic>> _sources = [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final res = await _auth.authorizedRequest(method: 'GET', path: '/crm/leads/source-counts');
      final map = Map<String, dynamic>.from(res as Map);
      _total = (map['total'] as num?)?.toInt() ?? 0;
      final list = map['sources'] as List<dynamic>? ?? [];
      _sources = list.map((e) => Map<String, dynamic>.from(e as Map)).toList();
    } catch (e) {
      _error = e.toString();
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _applyListFilter(int? sourceId) {
    if (Get.isRegistered<CrmController>()) {
      final c = Get.find<CrmController>();
      c.selectedSourceId.value = sourceId;
      c.applyFilters();
      Get.back();
    } else if (sourceId == null) {
      Get.offAllNamed(AppRoutes.crm);
    } else {
      Get.offAllNamed(AppRoutes.crm, arguments: {'sourceId': sourceId});
    }
  }

  Color _avatarColor(int index) {
    const colors = [
      Color(0xFF90A4AE),
      Color(0xFF8BC34A),
      Color(0xFF795548),
      Color(0xFFE91E63),
      Color(0xFF7E57C2),
      Color(0xFF26A69A),
    ];
    return colors[index % colors.length];
  }

  @override
  Widget build(BuildContext context) {
    const headerBg = Color(0xFF263238);
    return Scaffold(
      drawer: const AppNavigationDrawer(currentRoute: AppRoutes.crmLists),
      bottomNavigationBar: const RoleAwareBottomNav(currentRoute: AppRoutes.crmLists),
      appBar: AppBar(
        backgroundColor: headerBg,
        foregroundColor: Colors.white,
        iconTheme: const IconThemeData(color: Colors.white),
        title: Text(
          _loading ? 'All lists' : 'All lists (${_sources.length + 1})',
          style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600),
        ),
        actions: [
          IconButton(onPressed: _load, icon: const Icon(Icons.refresh_rounded), tooltip: 'Refresh'),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Text(_error!, textAlign: TextAlign.center),
                        const SizedBox(height: 16),
                        FilledButton(onPressed: _load, child: const Text('Retry')),
                      ],
                    ),
                  ),
                )
              : RefreshIndicator(
                  onRefresh: _load,
                  child: ListView(
                    padding: const EdgeInsets.fromLTRB(0, 8, 0, 88),
                    children: [
                      _ListRow(
                        leading: Container(
                          width: 44,
                          height: 44,
                          alignment: Alignment.center,
                          decoration: BoxDecoration(
                            color: const Color(0xFFE3F2FD),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: const Text('A', style: TextStyle(fontWeight: FontWeight.w800, color: Color(0xFF1565C0))),
                        ),
                        title: 'All Leads',
                        count: _total,
                        selected: true,
                        onTap: () => _applyListFilter(null),
                      ),
                      const Divider(height: 1),
                      ...List.generate(_sources.length, (i) {
                        final s = _sources[i];
                        final id = (s['id'] as num).toInt();
                        final name = (s['name'] ?? '').toString();
                        final c = (s['lead_count'] as num?)?.toInt() ?? 0;
                        final initial = name.isNotEmpty ? name[0].toUpperCase() : '?';
                        return Column(
                          children: [
                            _ListRow(
                              leading: CircleAvatar(
                                backgroundColor: _avatarColor(i),
                                child: Text(initial, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700)),
                              ),
                              title: name,
                              count: c,
                              onTap: () => _applyListFilter(id),
                            ),
                            const Divider(height: 1),
                          ],
                        );
                      }),
                    ],
                  ),
                ),
    );
  }
}

class _ListRow extends StatelessWidget {
  const _ListRow({
    required this.leading,
    required this.title,
    required this.count,
    required this.onTap,
    this.selected = false,
  });

  final Widget leading;
  final String title;
  final int count;
  final VoidCallback onTap;
  final bool selected;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: selected ? const Color(0xFFE3F2FD).withValues(alpha: 0.65) : Colors.transparent,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          child: Row(
            children: [
              leading,
              const SizedBox(width: 14),
              Expanded(
                child: Text(
                  title,
                  style: TextStyle(
                    fontSize: 15,
                    fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
                    color: const Color(0xFF37474F),
                  ),
                ),
              ),
              Icon(Icons.group_outlined, size: 18, color: Colors.grey.shade600),
              const SizedBox(width: 6),
              Text('$count', style: TextStyle(fontWeight: FontWeight.w700, color: Colors.grey.shade800)),
              if (!selected) ...[
                const SizedBox(width: 8),
                Icon(Icons.more_vert, size: 20, color: Colors.grey.shade500),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
