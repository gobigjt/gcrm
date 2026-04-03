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
    final border = OutlineInputBorder(
      borderRadius: BorderRadius.circular(10),
      borderSide: const BorderSide(color: Color(0xFFD7DADF)),
    );
    final denseInput = InputDecorationTheme(
      isDense: true,
      contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 11),
      border: border,
      enabledBorder: border,
      focusedBorder: border.copyWith(
        borderSide: const BorderSide(color: Color(0xFFB7D6F2), width: 1.2),
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
                      decoration: const InputDecoration(
                        labelText: 'Contact name *',
                        hintText: 'Enter full name',
                      ),
                    ),
                    const SizedBox(height: 8),
                    TextField(
                      controller: companyCtrl,
                      decoration: const InputDecoration(
                        labelText: 'Company',
                        hintText: 'Company name',
                      ),
                    ),
                    const SizedBox(height: 8),
                    TextField(
                      controller: phoneCtrl,
                      decoration: const InputDecoration(
                        labelText: 'Phone *',
                        hintText: '+91 XXXXX XXXXX',
                      ),
                    ),
                    const SizedBox(height: 8),
                    TextField(
                      controller: emailCtrl,
                      decoration: const InputDecoration(
                        labelText: 'Email',
                        hintText: 'email@company.com',
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 12),
              _sectionLabel(context, 'Lead source'),
              const SizedBox(height: 8),
              Obx(
                () => SingleChildScrollView(
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
                                    color: selected ? const Color(0xFF0C447C) : Theme.of(context).hintColor,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                                selected: selected,
                                selectedColor: const Color(0xFFE6F1FB),
                                backgroundColor: const Color(0xFFF3F4F6),
                                side: BorderSide(color: selected ? const Color(0xFFB7D6F2) : const Color(0xFFE5E7EB)),
                                onSelected: (_) => sourceId.value = s.id,
                              ),
                            );
                          },
                        )
                        .toList(),
                  ),
                ),
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
                      decoration: const InputDecoration(
                        labelText: 'Task Due Date',
                        suffixIcon: Icon(Icons.calendar_today_rounded),
                      ),
                    ),
                    const SizedBox(height: 8),
                    TextField(
                      controller: taskDescCtrl,
                      decoration: const InputDecoration(
                        labelText: 'Task Description',
                      ),
                      minLines: 2,
                      maxLines: 3,
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 14),
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
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 12),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                      ),
                      child: busy ? loading : const Text('Create lead'),
                    ),
                    const SizedBox(height: 10),
                    OutlinedButton(
                      onPressed: busy ? null : _saveLeadAndTask,
                      style: OutlinedButton.styleFrom(
                        foregroundColor: const Color(0xFF0C447C),
                        side: const BorderSide(color: Color(0xFFD7DADF)),
                        padding: const EdgeInsets.symmetric(vertical: 12),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
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
