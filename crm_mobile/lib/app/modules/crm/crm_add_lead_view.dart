import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../../core/utils/ui_format.dart';
import 'crm_controller.dart';
import 'crm_lead_detail_view.dart';

class CrmAddLeadView extends StatefulWidget {
  const CrmAddLeadView({super.key});

  @override
  State<CrmAddLeadView> createState() => _CrmAddLeadViewState();
}

class _CrmAddLeadViewState extends State<CrmAddLeadView> {
  final CrmController controller = Get.find<CrmController>();

  final TextEditingController nameCtrl = TextEditingController();
  final TextEditingController companyCtrl = TextEditingController();
  final TextEditingController phoneCtrl = TextEditingController();
  final TextEditingController emailCtrl = TextEditingController();
  final TextEditingController dueDateCtrl = TextEditingController(
    text: DateTime.now().toIso8601String().split('T').first,
  );
  final TextEditingController taskDescCtrl = TextEditingController();
  final RxnInt sourceId = RxnInt();

  @override
  void dispose() {
    nameCtrl.dispose();
    companyCtrl.dispose();
    phoneCtrl.dispose();
    emailCtrl.dispose();
    dueDateCtrl.dispose();
    taskDescCtrl.dispose();
    super.dispose();
  }

  Future<void> _saveLeadOnly() async {
    if (nameCtrl.text.trim().isEmpty || phoneCtrl.text.trim().isEmpty) {
      Get.snackbar('Missing data', 'Contact name and phone are required');
      return;
    }
    final createdLeadId = await controller.createLead(
      name: nameCtrl.text.trim(),
      email: emailCtrl.text.trim(),
      phone: phoneCtrl.text.trim(),
      company: companyCtrl.text.trim(),
      sourceId: sourceId.value,
    );
    if (!mounted) return;
    Navigator.of(context).pop();
    if (createdLeadId == null) {
      Get.snackbar('Lead created', 'New lead has been added');
      return;
    }
    Get.snackbar(
      'Lead created',
      'New lead has been added',
      mainButton: TextButton(
        onPressed: () {
          Get.closeCurrentSnackbar();
          Get.to(() => CrmLeadDetailView(leadId: createdLeadId));
        },
        child: const Text('Open'),
      ),
    );
  }

  Future<void> _saveLeadAndTask() async {
    if (nameCtrl.text.trim().isEmpty || phoneCtrl.text.trim().isEmpty) {
      Get.snackbar('Missing data', 'Contact name and phone are required');
      return;
    }
    if (dueDateCtrl.text.trim().isEmpty) {
      Get.snackbar('Missing data', 'Task due date is required');
      return;
    }
    final createdLeadId = await controller.createLead(
      name: nameCtrl.text.trim(),
      email: emailCtrl.text.trim(),
      phone: phoneCtrl.text.trim(),
      company: companyCtrl.text.trim(),
      sourceId: sourceId.value,
    );
    if (createdLeadId == null) {
      Get.snackbar('Error', 'Lead created but unable to attach task');
      if (mounted) Navigator.of(context).pop();
      return;
    }
    await controller.addFollowup(
      leadId: createdLeadId,
      dueDate: dueDateCtrl.text.trim(),
      description: taskDescCtrl.text.trim(),
    );
    if (!mounted) return;
    Navigator.of(context).pop();
    Get.snackbar(
      'Lead and task saved',
      'Follow-up task added successfully',
      mainButton: TextButton(
        onPressed: () {
          Get.closeCurrentSnackbar();
          Get.to(() => CrmLeadDetailView(leadId: createdLeadId));
        },
        child: const Text('Open'),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final border = OutlineInputBorder(
      borderRadius: BorderRadius.circular(10),
      borderSide: BorderSide(
        color: scheme.outline.withValues(alpha: isDark ? 0.7 : 1),
        width: 1,
      ),
    );
    final denseInput = InputDecorationTheme(
      isDense: true,
      filled: true,
      fillColor: isDark ? const Color(0xFF0F172A) : Colors.white,
      contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 11),
      border: border,
      enabledBorder: border,
      focusedBorder: border.copyWith(
        borderSide: BorderSide(
          color: scheme.primary,
          width: 1.4,
        ),
      ),
    );
    return Scaffold(
      appBar: AppBar(
        leadingWidth: 86,
        leading: TextButton(
          onPressed: () => Navigator.of(context).maybePop(),
          style: TextButton.styleFrom(
            foregroundColor: const Color(0xFF185FA5),
            alignment: Alignment.centerLeft,
            padding: const EdgeInsets.only(left: 8, right: 4),
          ),
          child: const Text(
            '< Back',
            style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
          ),
        ),
        titleSpacing: 0,
        title: const Text(
          'New lead',
          style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700),
        ),
        centerTitle: false,
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              _sectionLabel(context, 'Contact details'),
              const SizedBox(height: 6),
              Theme(
                data: Theme.of(context).copyWith(inputDecorationTheme: denseInput),
                child: Column(
                  children: [
                    TextField(
                      controller: nameCtrl,
                      decoration: InputDecoration(
                        labelText: 'Contact name *',
                        hintText: 'Enter full name',
                        floatingLabelBehavior: FloatingLabelBehavior.always,
                        labelStyle: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.w600,
                          color: scheme.onSurfaceVariant,
                        ),
                      ),
                    ),
                    const SizedBox(height: 8),
                    TextField(
                      controller: companyCtrl,
                      decoration: InputDecoration(
                        labelText: 'Company',
                        hintText: 'Company name',
                        floatingLabelBehavior: FloatingLabelBehavior.always,
                        labelStyle: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.w600,
                          color: scheme.onSurfaceVariant,
                        ),
                      ),
                    ),
                    const SizedBox(height: 8),
                    TextField(
                      controller: phoneCtrl,
                      decoration: InputDecoration(
                        labelText: 'Phone *',
                        hintText: '+91 XXXXX XXXXX',
                        floatingLabelBehavior: FloatingLabelBehavior.always,
                        labelStyle: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.w600,
                          color: scheme.onSurfaceVariant,
                        ),
                      ),
                    ),
                    const SizedBox(height: 8),
                    TextField(
                      controller: emailCtrl,
                      decoration: InputDecoration(
                        labelText: 'Email',
                        hintText: 'email@company.com',
                        floatingLabelBehavior: FloatingLabelBehavior.always,
                        labelStyle: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.w600,
                          color: scheme.onSurfaceVariant,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 12),
              _sectionLabel(context, 'Lead source'),
              const SizedBox(height: 8),
              Obx(
                () {
                  final scheme = Theme.of(context).colorScheme;
                  final isDark = Theme.of(context).brightness == Brightness.dark;
                  final selectedBg = const Color(0xFFE6F1FB);
                  final selectedFg = const Color(0xFF0C447C);
                  final unselectedBg = isDark ? scheme.surfaceContainerHighest : const Color(0xFFF3F4F6);
                  final unselectedFg = scheme.onSurfaceVariant;
                  final selectedBorder = const Color(0xFFB7D6F2);
                  final unselectedBorder = scheme.outline.withValues(alpha: 0.5);

                  return SingleChildScrollView(
                    scrollDirection: Axis.horizontal,
                    child: Row(
                      children: controller.sources
                          .map(
                            (s) {
                              final selected = sourceId.value == s.id;
                              return Padding(
                                padding: const EdgeInsets.only(right: 6),
                                child: ChoiceChip(
                                  labelPadding: const EdgeInsets.symmetric(horizontal: 4),
                                  visualDensity: const VisualDensity(horizontal: -2, vertical: -2),
                                  label: Text(
                                    s.name,
                                    style: TextStyle(
                                      fontSize: 12,
                                      color: selected ? selectedFg : unselectedFg,
                                      fontWeight: FontWeight.w600,
                                    ),
                                  ),
                                  selected: selected,
                                  selectedColor: selectedBg,
                                  backgroundColor: unselectedBg,
                                  side: BorderSide(color: selected ? selectedBorder : unselectedBorder),
                                  onSelected: (_) => sourceId.value = s.id,
                                ),
                              );
                            },
                          )
                          .toList(),
                    ),
                  );
                },
              ),
              const SizedBox(height: 12),
              _sectionLabel(context, 'Task (optional)'),
              const SizedBox(height: 6),
              Theme(
                data: Theme.of(context).copyWith(inputDecorationTheme: denseInput),
                child: Column(
                  children: [
                    TextField(
                      controller: dueDateCtrl,
                      readOnly: true,
                      onTap: () => pickDateIntoController(context: context, controller: dueDateCtrl),
                      decoration: InputDecoration(
                        labelText: 'Task Due Date',
                        suffixIcon: Icon(Icons.calendar_today_rounded),
                        floatingLabelBehavior: FloatingLabelBehavior.always,
                        labelStyle: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.w600,
                          color: scheme.onSurfaceVariant,
                        ),
                      ),
                    ),
                    const SizedBox(height: 8),
                    TextField(
                      controller: taskDescCtrl,
                      decoration: InputDecoration(
                        labelText: 'Task Description',
                        floatingLabelBehavior: FloatingLabelBehavior.always,
                        labelStyle: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.w600,
                          color: scheme.onSurfaceVariant,
                        ),
                      ),
                      minLines: 2,
                      maxLines: 3,
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 18),
              Obx(() {
                final busy = controller.isSubmitting.value;
                final loading = const SizedBox(
                  width: 20,
                  height: 20,
                  child: CircularProgressIndicator(strokeWidth: 2),
                );
                return Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    FilledButton(
                      onPressed: busy ? null : _saveLeadOnly,
                      style: FilledButton.styleFrom(
                        backgroundColor: const Color(0xFF185FA5),
                        foregroundColor: const Color(0xFFFFFFFF),
                        padding: const EdgeInsets.symmetric(vertical: 12),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                      ),
                      child: busy ? loading : const Text('Create lead'),
                    ),
                    const SizedBox(height: 10),
                    OutlinedButton(
                      onPressed: busy ? null : _saveLeadAndTask,
                      style: OutlinedButton.styleFrom(
                        foregroundColor: const Color(0xFF0C447C),
                        side: BorderSide(color: Theme.of(context).dividerColor, width: 1),
                        padding: const EdgeInsets.symmetric(vertical: 12),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                      ),
                      child: busy ? loading : const Text('Save & add task'),
                    ),
                  ],
                );
              }),
            ],
          ),
        ),
      ),
    );
  }

  Widget _sectionLabel(BuildContext context, String text) {
    return Text(
      text.toUpperCase(),
      style: Theme.of(context).textTheme.bodySmall?.copyWith(
            color: Theme.of(context).hintColor,
            fontWeight: FontWeight.w600,
            letterSpacing: 0.4,
          ),
    );
  }
}
