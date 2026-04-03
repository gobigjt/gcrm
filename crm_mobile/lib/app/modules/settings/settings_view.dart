import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../../core/models/settings_models.dart';
import '../../core/utils/ui_format.dart';
import '../../shared/widgets/app_error_banner.dart';
import '../../shared/widgets/app_bottom_nav.dart';
import 'settings_controller.dart';

class SettingsView extends GetView<SettingsController> {
  const SettingsView({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Settings'),
        actions: [
          IconButton(onPressed: controller.loadAll, icon: const Icon(Icons.refresh_rounded)),
        ],
      ),
      floatingActionButton: Obx(
        () => controller.isAdminOrSuper
            ? FloatingActionButton.extended(
                onPressed: () => _openCompanyEditSheet(context),
                icon: const Icon(Icons.edit_rounded),
                label: const Text('Edit Company'),
              )
            : const SizedBox.shrink(),
      ),
      body: Obx(() {
        if (controller.isLoading.value) return const Center(child: CircularProgressIndicator());
        if (controller.errorMessage.value.isNotEmpty) {
          return Padding(
            padding: const EdgeInsets.all(16),
            child: AppErrorBanner(
              message: controller.errorMessage.value,
              onRetry: controller.loadAll,
            ),
          );
        }
        final c = controller.company.value ?? CompanyProfile.empty;
        return ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Card(
              child: Padding(
                padding: const EdgeInsets.all(14),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Company Profile', style: Theme.of(context).textTheme.titleMedium),
                    const SizedBox(height: 8),
                    _kv('Name', c.companyName.isEmpty ? '—' : c.companyName),
                    _kv('GSTIN', c.gstin.isEmpty ? '—' : c.gstin),
                    _kv('Email', c.email.isEmpty ? '—' : c.email),
                    _kv('Phone', c.phone.isEmpty ? '—' : c.phone),
                    _kv('Address', c.address.isEmpty ? '—' : c.address),
                    _kv('Currency', c.currency.isEmpty ? 'INR' : c.currency),
                    _kv('Fiscal Year Start', formatIsoDate(c.fiscalYearStart)),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 12),
            Text('Module Access', style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 8),
            ...controller.modules.map((m) {
              final roles = m.allowedRoles;
              return Card(
                child: SwitchListTile(
                  value: m.isEnabled,
                  onChanged: controller.isAdminOrSuper
                      ? (v) => controller.toggleModule(
                            moduleKey: m.moduleKey,
                            isEnabled: v,
                            allowedRoles: roles,
                          )
                      : null,
                  title: Text(m.label.isEmpty ? m.moduleKey : m.label),
                  subtitle: Text('Roles: ${roles.join(', ')}'),
                ),
              );
            }),
          ],
        );
      }),
      bottomNavigationBar: const AppBottomNav(currentIndex: 4),
    );
  }

  Future<void> _openCompanyEditSheet(BuildContext context) async {
    final c = controller.company.value ?? CompanyProfile.empty;
    final nameCtrl = TextEditingController(text: c.companyName);
    final gstinCtrl = TextEditingController(text: c.gstin);
    final addrCtrl = TextEditingController(text: c.address);
    final phoneCtrl = TextEditingController(text: c.phone);
    final emailCtrl = TextEditingController(text: c.email);
    final currencyCtrl = TextEditingController(text: c.currency.isEmpty ? 'INR' : c.currency);
    final fyCtrl = TextEditingController(text: formatIsoDate(c.fiscalYearStart));

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
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(controller: nameCtrl, decoration: const InputDecoration(labelText: 'Company Name *')),
            const SizedBox(height: 8),
            TextField(controller: gstinCtrl, decoration: const InputDecoration(labelText: 'GSTIN')),
            const SizedBox(height: 8),
            TextField(controller: addrCtrl, decoration: const InputDecoration(labelText: 'Address')),
            const SizedBox(height: 8),
            TextField(controller: phoneCtrl, decoration: const InputDecoration(labelText: 'Phone')),
            const SizedBox(height: 8),
            TextField(controller: emailCtrl, decoration: const InputDecoration(labelText: 'Email')),
            const SizedBox(height: 8),
            TextField(controller: currencyCtrl, decoration: const InputDecoration(labelText: 'Currency')),
            const SizedBox(height: 8),
            TextField(
              controller: fyCtrl,
              readOnly: true,
              onTap: () => pickDateIntoController(context: context, controller: fyCtrl),
              decoration: const InputDecoration(
                labelText: 'Fiscal Year Start',
                suffixIcon: Icon(Icons.calendar_today_rounded),
              ),
            ),
            const SizedBox(height: 12),
            Obx(
              () => FilledButton(
                onPressed: controller.isSubmitting.value
                    ? null
                    : () async {
                        if (nameCtrl.text.trim().isEmpty) {
                          Get.snackbar('Missing data', 'Company name is required');
                          return;
                        }
                        await controller.updateCompany(
                          companyName: nameCtrl.text.trim(),
                          gstin: gstinCtrl.text.trim(),
                          address: addrCtrl.text.trim(),
                          phone: phoneCtrl.text.trim(),
                          email: emailCtrl.text.trim(),
                          currency: currencyCtrl.text.trim(),
                          fiscalYearStart: fyCtrl.text.trim(),
                        );
                        if (context.mounted) Navigator.of(context).pop();
                      },
                child: controller.isSubmitting.value
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Text('Save Settings'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

Widget _kv(String label, String value) {
  return Padding(
    padding: const EdgeInsets.only(bottom: 6),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(width: 130, child: Text(label, style: const TextStyle(fontWeight: FontWeight.w600))),
        Expanded(child: Text(value)),
      ],
    ),
  );
}
