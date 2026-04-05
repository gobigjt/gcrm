import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../../routes/app_routes.dart';
import '../../shared/widgets/app_error_banner.dart';
import '../../shared/widgets/app_navigation_drawer.dart';
import '../../shared/widgets/role_aware_bottom_nav.dart';
import 'users_controller.dart';

class UsersView extends GetView<UsersController> {
  const UsersView({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      drawer: const AppNavigationDrawer(currentRoute: AppRoutes.users),
      appBar: AppBar(
        title: const Text('Users'),
        actions: [
          IconButton(onPressed: controller.loadAll, icon: const Icon(Icons.refresh_rounded)),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _openCreateUserSheet(context),
        icon: const Icon(Icons.person_add_alt_1_rounded),
        label: const Text('New User'),
      ),
      body: Obx(() {
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
              return Card(
                child: ListTile(
                  title: Text(u.name),
                  subtitle: Text('${u.email} • ${u.role}'),
                  trailing: TextButton(
                    onPressed: () => controller.toggleStatus(u.id),
                    child: Text(u.isActive ? 'Disable' : 'Enable'),
                  ),
                ),
              );
            },
          ),
        );
      }),
      bottomNavigationBar: const RoleAwareBottomNav(currentRoute: AppRoutes.users),
    );
  }

  Future<void> _openCreateUserSheet(BuildContext context) async {
    final nameCtrl = TextEditingController();
    final emailCtrl = TextEditingController();
    final passwordCtrl = TextEditingController();
    final role = 'Sales Executive'.obs;

    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      builder: (_) => Padding(
        padding: EdgeInsets.only(
          left: 16,
          right: 16,
          top: 16,
          bottom: MediaQuery.of(context).viewInsets.bottom + 16,
        ),
        child: Obx(
          () => Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(controller: nameCtrl, decoration: const InputDecoration(labelText: 'Name *')),
              const SizedBox(height: 8),
              TextField(controller: emailCtrl, decoration: const InputDecoration(labelText: 'Email *')),
              const SizedBox(height: 8),
              TextField(controller: passwordCtrl, decoration: const InputDecoration(labelText: 'Password *')),
              const SizedBox(height: 8),
              DropdownButtonFormField<String>(
                value: role.value,
                items: controller.roles
                    .map((r) => DropdownMenuItem<String>(
                          value: r.name.isEmpty ? 'Sales Executive' : r.name,
                          child: Text(r.name.isEmpty ? 'Sales Executive' : r.name),
                        ))
                    .toList(),
                onChanged: (v) => role.value = v ?? 'Sales Executive',
                decoration: const InputDecoration(labelText: 'Role'),
              ),
              const SizedBox(height: 12),
              FilledButton(
                onPressed: controller.isSubmitting.value
                    ? null
                    : () async {
                        if (nameCtrl.text.trim().isEmpty ||
                            emailCtrl.text.trim().isEmpty ||
                            passwordCtrl.text.trim().isEmpty) {
                          Get.snackbar('Missing data', 'Name, email and password are required');
                          return;
                        }
                        await controller.createUser(
                          name: nameCtrl.text.trim(),
                          email: emailCtrl.text.trim(),
                          password: passwordCtrl.text.trim(),
                          role: role.value,
                        );
                        if (context.mounted) Navigator.of(context).pop();
                      },
                child: controller.isSubmitting.value
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Text('Save User'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
