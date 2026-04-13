import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../../core/models/users_models.dart';
import '../../core/network/error_utils.dart';
import '../../routes/app_routes.dart';
import '../../shared/widgets/app_error_banner.dart';
import '../../shared/widgets/app_navigation_drawer.dart';
import '../../shared/widgets/role_aware_bottom_nav.dart';
import 'users_controller.dart';

class UsersView extends StatefulWidget {
  const UsersView({super.key});

  @override
  State<UsersView> createState() => _UsersViewState();
}

class _UsersViewState extends State<UsersView> with SingleTickerProviderStateMixin {
  late final TabController _tabs;

  @override
  void initState() {
    super.initState();
    _tabs = TabController(length: 2, vsync: this);
    _tabs.addListener(() => setState(() {}));
  }

  @override
  void dispose() {
    _tabs.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final controller = Get.find<UsersController>();
    return Scaffold(
      drawer: const AppNavigationDrawer(currentRoute: AppRoutes.users),
      appBar: AppBar(
        title: const Text('Users & zones'),
        actions: [
          IconButton(onPressed: controller.loadAll, icon: const Icon(Icons.refresh_rounded)),
        ],
        bottom: TabBar(
          controller: _tabs,
          tabs: const [
            Tab(text: 'Users'),
            Tab(text: 'Zones'),
          ],
        ),
      ),
      floatingActionButton: _tabs.index == 0
          ? FloatingActionButton.extended(
              onPressed: () => _openCreateUserSheet(context, controller),
              icon: const Icon(Icons.person_add_alt_1_rounded),
              label: const Text('New user'),
            )
          : FloatingActionButton.extended(
              onPressed: () => _openZoneSheet(context, controller, null),
              icon: const Icon(Icons.add_location_alt_outlined),
              label: const Text('New zone'),
            ),
      body: TabBarView(
        controller: _tabs,
        children: [
          _UsersTabBody(controller: controller),
          _ZonesTabBody(controller: controller),
        ],
      ),
      bottomNavigationBar: const RoleAwareBottomNav(currentRoute: AppRoutes.users),
    );
  }
}

class _UsersTabBody extends StatelessWidget {
  const _UsersTabBody({required this.controller});

  final UsersController controller;

  @override
  Widget build(BuildContext context) {
    return Obx(() {
      if (controller.isLoading.value) {
        return const Center(child: CircularProgressIndicator());
      }
      if (controller.errorMessage.value.isNotEmpty) {
        return Padding(
          padding: const EdgeInsets.all(16),
          child: AppErrorBanner(
            message: controller.errorMessage.value,
            onRetry: controller.loadAll,
          ),
        );
      }
      if (controller.users.isEmpty) {
        return const Center(child: Text('No users found'));
      }
      return RefreshIndicator(
        onRefresh: controller.loadUsers,
        child: ListView.separated(
          padding: const EdgeInsets.all(16),
          itemCount: controller.users.length,
          separatorBuilder: (_, __) => const SizedBox(height: 8),
          itemBuilder: (_, i) {
            final u = controller.users[i];
            final zone = u.zoneName?.trim().isNotEmpty == true ? u.zoneName! : null;
            final mgr = u.salesManagerName?.trim().isNotEmpty == true ? u.salesManagerName! : null;
            return Card(
              child: ListTile(
                title: Text(u.name),
                subtitle: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('${u.email} • ${u.role}'),
                    if (zone != null) Text('Zone: $zone', style: Theme.of(context).textTheme.bodySmall),
                    if (u.role == 'Sales Executive' && mgr != null)
                      Text('Manager: $mgr', style: Theme.of(context).textTheme.bodySmall),
                  ],
                ),
                isThreeLine: zone != null || (u.role == 'Sales Executive' && mgr != null),
                onTap: () => _openEditUserSheet(context, controller, u),
                trailing: TextButton(
                  onPressed: () => controller.toggleStatus(u.id),
                  child: Text(u.isActive ? 'Disable' : 'Enable'),
                ),
              ),
            );
          },
        ),
      );
    });
  }
}

class _ZonesTabBody extends StatelessWidget {
  const _ZonesTabBody({required this.controller});

  final UsersController controller;

  @override
  Widget build(BuildContext context) {
    return Obx(() {
      if (controller.isLoading.value) {
        return const Center(child: CircularProgressIndicator());
      }
      if (controller.errorMessage.value.isNotEmpty) {
        return Padding(
          padding: const EdgeInsets.all(16),
          child: AppErrorBanner(
            message: controller.errorMessage.value,
            onRetry: controller.loadAll,
          ),
        );
      }
      if (controller.zones.isEmpty) {
        return Center(
          child: ListView(
            children: const [
              SizedBox(height: 120),
              Text('No zones yet', textAlign: TextAlign.center),
            ],
          ),
        );
      }
      return RefreshIndicator(
        onRefresh: controller.loadZones,
        child: ListView.separated(
          padding: const EdgeInsets.all(16),
          itemCount: controller.zones.length,
          separatorBuilder: (_, __) => const SizedBox(height: 8),
          itemBuilder: (_, i) {
            final z = controller.zones[i];
            return Card(
              child: ListTile(
                title: Text(z.name),
                subtitle: Text(z.code?.isNotEmpty == true ? 'Code: ${z.code}' : 'No code'),
                trailing: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    IconButton(
                      icon: const Icon(Icons.edit_outlined),
                      onPressed: () => _openZoneSheet(context, controller, z),
                    ),
                    IconButton(
                      icon: const Icon(Icons.delete_outline),
                      onPressed: () async {
                        final ok = await showDialog<bool>(
                          context: context,
                          builder: (ctx) => AlertDialog(
                            title: const Text('Delete zone'),
                            content: Text('Delete “${z.name}”? Users in this zone will have zone cleared.'),
                            actions: [
                              TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
                              FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Delete')),
                            ],
                          ),
                        );
                        if (ok == true) {
                          try {
                            await controller.deleteZone(z.id);
                          } catch (e) {
                            if (context.mounted) {
                              Get.snackbar('Error', e.toString());
                            }
                          }
                        }
                      },
                    ),
                  ],
                ),
              ),
            );
          },
        ),
      );
    });
  }
}

Future<void> _openZoneSheet(BuildContext context, UsersController c, ZoneRow? existing) async {
  final nameCtrl = TextEditingController(text: existing?.name ?? '');
  final codeCtrl = TextEditingController(text: existing?.code ?? '');
  await showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    builder: (ctx) => Padding(
      padding: EdgeInsets.only(
        left: 16,
        right: 16,
        top: 16,
        bottom: MediaQuery.of(ctx).viewInsets.bottom + 16,
      ),
      child: Obx(
        () => Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(existing == null ? 'New zone' : 'Edit zone', style: Theme.of(ctx).textTheme.titleMedium),
            const SizedBox(height: 12),
            TextField(controller: nameCtrl, decoration: const InputDecoration(labelText: 'Name *')),
            const SizedBox(height: 8),
            TextField(controller: codeCtrl, decoration: const InputDecoration(labelText: 'Code (optional)')),
            const SizedBox(height: 12),
            FilledButton(
              onPressed: c.isSubmitting.value
                  ? null
                  : () async {
                      if (nameCtrl.text.trim().isEmpty) {
                        Get.snackbar('Missing name', 'Zone name is required');
                        return;
                      }
                      try {
                        if (existing == null) {
                          await c.createZone(name: nameCtrl.text.trim(), code: codeCtrl.text.trim());
                        } else {
                          await c.updateZone(
                            id: existing.id,
                            name: nameCtrl.text.trim(),
                            code: codeCtrl.text.trim(),
                          );
                        }
                        if (ctx.mounted) Navigator.of(ctx).pop();
                      } catch (e) {
                        Get.snackbar('Error', userFriendlyError(e));
                      }
                    },
              child: c.isSubmitting.value
                  ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2))
                  : Text(existing == null ? 'Create' : 'Save'),
            ),
          ],
        ),
      ),
    ),
  );
}

Future<void> _openCreateUserSheet(BuildContext context, UsersController c) async {
  final nameCtrl = TextEditingController();
  final emailCtrl = TextEditingController();
  final passwordCtrl = TextEditingController();
  final role = 'Sales Executive'.obs;
  final zoneId = Rxn<int>();
  final managerId = Rxn<int>();

  await c.loadSalesManagers();
  if (!context.mounted) return;

  await showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    builder: (ctx) => Padding(
      padding: EdgeInsets.only(
        left: 16,
        right: 16,
        top: 16,
        bottom: MediaQuery.of(ctx).viewInsets.bottom + 16,
      ),
      child: Obx(
        () => SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              TextField(controller: nameCtrl, decoration: const InputDecoration(labelText: 'Name *')),
              const SizedBox(height: 8),
              TextField(controller: emailCtrl, decoration: const InputDecoration(labelText: 'Email *')),
              const SizedBox(height: 8),
              TextField(
                controller: passwordCtrl,
                obscureText: true,
                decoration: const InputDecoration(labelText: 'Password *'),
              ),
              const SizedBox(height: 8),
              DropdownButtonFormField<String>(
                value: role.value,
                items: c.roles
                    .map(
                      (r) => DropdownMenuItem<String>(
                        value: r.name.isEmpty ? 'Sales Executive' : r.name,
                        child: Text(r.name.isEmpty ? 'Sales Executive' : r.name),
                      ),
                    )
                    .toList(),
                onChanged: (v) {
                  final next = v ?? 'Sales Executive';
                  if (!isSalesExecutiveRole(next)) managerId.value = null;
                  role.value = next;
                },
                decoration: const InputDecoration(labelText: 'Role'),
              ),
              const SizedBox(height: 8),
              DropdownButtonFormField<int?>(
                value: zoneId.value,
                items: [
                  const DropdownMenuItem<int?>(value: null, child: Text('— No zone —')),
                  ...c.zones.map((z) => DropdownMenuItem<int?>(value: z.id, child: Text(z.name))),
                ],
                onChanged: (v) => zoneId.value = v,
                decoration: const InputDecoration(labelText: 'Zone'),
              ),
              if (isSalesExecutiveRole(role.value)) ...[
                const SizedBox(height: 8),
                DropdownButtonFormField<int?>(
                  value: managerId.value,
                  items: [
                    const DropdownMenuItem<int?>(value: null, child: Text('— No manager —')),
                    ...c.salesManagers.map(
                      (m) => DropdownMenuItem<int?>(value: m.id, child: Text(m.name)),
                    ),
                  ],
                  onChanged: (v) => managerId.value = v,
                  decoration: const InputDecoration(labelText: 'Sales manager'),
                ),
              ],
              const SizedBox(height: 12),
              FilledButton(
                onPressed: c.isSubmitting.value
                    ? null
                    : () async {
                        if (nameCtrl.text.trim().isEmpty ||
                            emailCtrl.text.trim().isEmpty ||
                            passwordCtrl.text.trim().isEmpty) {
                          Get.snackbar('Missing data', 'Name, email and password are required');
                          return;
                        }
                        try {
                          await c.createUser(
                            name: nameCtrl.text.trim(),
                            email: emailCtrl.text.trim(),
                            password: passwordCtrl.text.trim(),
                            role: role.value,
                            zoneId: zoneId.value,
                            salesManagerId: isSalesExecutiveRole(role.value) ? managerId.value : null,
                          );
                          if (ctx.mounted) Navigator.of(ctx).pop();
                        } catch (e) {
                          Get.snackbar('Error', userFriendlyError(e));
                        }
                      },
                child: c.isSubmitting.value
                    ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2))
                    : const Text('Create user'),
              ),
            ],
          ),
        ),
      ),
    ),
  );
}

Future<void> _openEditUserSheet(BuildContext context, UsersController c, AdminUserRow u) async {
  final nameCtrl = TextEditingController(text: u.name);
  final emailCtrl = TextEditingController(text: u.email);
  final passwordCtrl = TextEditingController();
  final role = u.role.obs;
  final zoneIds = c.zones.map((z) => z.id).toSet();
  final initialZone = u.zoneId != null && zoneIds.contains(u.zoneId) ? u.zoneId : null;
  final zoneId = Rxn<int>(initialZone);
  await c.loadSalesManagers();
  if (!context.mounted) return;
  final mgrIds = c.salesManagers.where((m) => m.id != u.id).map((m) => m.id).toSet();
  final initialMgr =
      u.salesManagerId != null && mgrIds.contains(u.salesManagerId) ? u.salesManagerId : null;
  final managerId = Rxn<int>(initialMgr);
  final team = Rxn<SalesTeamPayload>();
  final executiveToAdd = Rxn<int>();

  Future<void> refreshTeam() async {
    if (role.value != 'Sales Manager') {
      team.value = null;
      return;
    }
    try {
      team.value = await c.loadSalesTeam(u.id);
    } catch (_) {
      team.value = SalesTeamPayload(assigned: [], available: []);
    }
  }

  await refreshTeam();

  if (!context.mounted) return;
  await showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    builder: (ctx) => Padding(
      padding: EdgeInsets.only(
        left: 16,
        right: 16,
        top: 16,
        bottom: MediaQuery.of(ctx).viewInsets.bottom + 16,
      ),
      child: Obx(
        () {
          void onRoleChanged(String? v) {
            role.value = v ?? u.role;
            if (!isSalesExecutiveRole(role.value)) {
              managerId.value = null;
            }
            if (role.value == 'Sales Manager') {
              c.loadSalesTeam(u.id).then((t) => team.value = t);
            } else {
              team.value = null;
            }
          }

          final t = team.value;
          final zoneIds = c.zones.map((z) => z.id).toSet();
          final safeZone = zoneId.value != null && zoneIds.contains(zoneId.value) ? zoneId.value : null;

          return SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text('Edit ${u.name}', style: Theme.of(ctx).textTheme.titleMedium),
                const SizedBox(height: 12),
                TextField(controller: nameCtrl, decoration: const InputDecoration(labelText: 'Name *')),
                const SizedBox(height: 8),
                TextField(controller: emailCtrl, decoration: const InputDecoration(labelText: 'Email *')),
                const SizedBox(height: 8),
                TextField(
                  controller: passwordCtrl,
                  obscureText: true,
                  decoration: const InputDecoration(labelText: 'New password (optional)'),
                ),
                const SizedBox(height: 8),
                DropdownButtonFormField<String>(
                  value: role.value,
                  items: c.roles
                      .map(
                        (r) => DropdownMenuItem<String>(
                          value: r.name.isEmpty ? 'Sales Executive' : r.name,
                          child: Text(r.name.isEmpty ? 'Sales Executive' : r.name),
                        ),
                      )
                      .toList(),
                  onChanged: onRoleChanged,
                  decoration: const InputDecoration(labelText: 'Role'),
                ),
                const SizedBox(height: 8),
                DropdownButtonFormField<int?>(
                  value: safeZone,
                  items: [
                    const DropdownMenuItem<int?>(value: null, child: Text('— No zone —')),
                    ...c.zones.map((z) => DropdownMenuItem<int?>(value: z.id, child: Text(z.name))),
                  ],
                  onChanged: (v) => zoneId.value = v,
                  decoration: const InputDecoration(labelText: 'Zone'),
                ),
                if (isSalesExecutiveRole(role.value)) ...[
                  const SizedBox(height: 8),
                  DropdownButtonFormField<int?>(
                    value: managerId.value,
                    items: [
                      const DropdownMenuItem<int?>(value: null, child: Text('— No manager —')),
                      ...c.salesManagers
                          .where((m) => m.id != u.id)
                          .map((m) => DropdownMenuItem<int?>(value: m.id, child: Text(m.name))),
                    ],
                    onChanged: (v) => managerId.value = v,
                    decoration: const InputDecoration(labelText: 'Sales manager'),
                  ),
                ],
                if (role.value == 'Sales Manager' && t != null) ...[
                  const SizedBox(height: 16),
                  const Divider(),
                  Text('Sales executives', style: Theme.of(ctx).textTheme.titleSmall),
                  const SizedBox(height: 8),
                  if (t.assigned.isEmpty) const Text('None assigned yet.', style: TextStyle(fontSize: 13)),
                  ...t.assigned.map(
                    (ex) => ListTile(
                      dense: true,
                      contentPadding: EdgeInsets.zero,
                      title: Text(ex.name),
                      subtitle: Text(ex.email),
                      trailing: IconButton(
                        icon: const Icon(Icons.remove_circle_outline, color: Colors.redAccent),
                        onPressed: c.isSubmitting.value
                            ? null
                            : () async {
                                try {
                                  await c.setExecutiveManager(executiveId: ex.id, managerId: null);
                                  team.value = await c.loadSalesTeam(u.id);
                                  executiveToAdd.value = null;
                                } catch (e) {
                                  Get.snackbar('Error', userFriendlyError(e));
                                }
                              },
                      ),
                    ),
                  ),
                  if (t.available.isNotEmpty) ...[
                    const SizedBox(height: 8),
                    DropdownButtonFormField<int?>(
                      value: executiveToAdd.value != null &&
                              t.available.any((e) => e.id == executiveToAdd.value)
                          ? executiveToAdd.value
                          : null,
                      items: [
                        const DropdownMenuItem<int?>(value: null, child: Text('— Select executive —')),
                        ...t.available.map(
                          (ex) => DropdownMenuItem<int?>(value: ex.id, child: Text(ex.name)),
                        ),
                      ],
                      onChanged: (v) => executiveToAdd.value = v,
                      decoration: const InputDecoration(labelText: 'Add to team'),
                    ),
                    const SizedBox(height: 8),
                    FilledButton.tonal(
                      onPressed: c.isSubmitting.value || executiveToAdd.value == null
                          ? null
                          : () async {
                              final id = executiveToAdd.value;
                              if (id == null) return;
                              try {
                                await c.setExecutiveManager(executiveId: id, managerId: u.id);
                                team.value = await c.loadSalesTeam(u.id);
                                executiveToAdd.value = null;
                              } catch (e) {
                                Get.snackbar('Error', userFriendlyError(e));
                              }
                            },
                      child: const Text('Add to team'),
                    ),
                  ],
                ],
                const SizedBox(height: 12),
                FilledButton(
                  onPressed: c.isSubmitting.value
                      ? null
                      : () async {
                          if (nameCtrl.text.trim().isEmpty || emailCtrl.text.trim().isEmpty) {
                            Get.snackbar('Missing data', 'Name and email are required');
                            return;
                          }
                          try {
                            await c.updateUser(
                              id: u.id,
                              name: nameCtrl.text.trim(),
                              email: emailCtrl.text.trim(),
                              role: role.value,
                              password: passwordCtrl.text.trim().isEmpty ? null : passwordCtrl.text.trim(),
                              zoneId: zoneId.value,
                              salesManagerId: isSalesExecutiveRole(role.value) ? managerId.value : null,
                            );
                            if (ctx.mounted) Navigator.of(ctx).pop();
                          } catch (e) {
                            Get.snackbar('Error', userFriendlyError(e));
                          }
                        },
                  child: c.isSubmitting.value
                      ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2))
                      : const Text('Save'),
                ),
              ],
            ),
          );
        },
      ),
    ),
  );
}
