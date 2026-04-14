import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../../core/auth/role_permissions.dart';
import '../../core/utils/ui_format.dart';
import '../auth/auth_controller.dart';
import 'crm_controller.dart';
import 'crm_lead_detail_view.dart';

class CrmAddLeadView extends StatefulWidget {
  const CrmAddLeadView({super.key});

  @override
  State<CrmAddLeadView> createState() => _CrmAddLeadViewState();
}

class _CrmAddLeadViewState extends State<CrmAddLeadView> {
  final CrmController controller = Get.find<CrmController>();
  final AuthController _auth = Get.find<AuthController>();

  final TextEditingController nameCtrl = TextEditingController();
  final TextEditingController companyCtrl = TextEditingController();
  final TextEditingController phoneCtrl = TextEditingController();
  final TextEditingController emailCtrl = TextEditingController();
  final TextEditingController dueDateCtrl = TextEditingController(
    text: DateTime.now().toIso8601String().split('T').first,
  );
  final TextEditingController taskDescCtrl = TextEditingController();
  final TextEditingController segmentCtrl = TextEditingController();
  final TextEditingController jobTitleCtrl = TextEditingController();
  final TextEditingController websiteCtrl = TextEditingController();
  final TextEditingController addressCtrl = TextEditingController();
  final TextEditingController tagsCtrl = TextEditingController();
  final TextEditingController notesCtrl = TextEditingController();
  final TextEditingController dealSizeCtrl = TextEditingController();
  final TextEditingController scoreCtrl = TextEditingController();
  final RxnInt sourceId = RxnInt();
  final RxnInt stageId = RxnInt();
  final RxnInt assignedTo = RxnInt();
  final RxnInt assignedManagerId = RxnInt();
  final priority = 'warm'.obs;
  final assignees = <Map<String, dynamic>>[].obs;

  @override
  void initState() {
    super.initState();
    _loadAssignees();
  }

  Future<void> _loadAssignees() async {
    try {
      final res = await _auth.authorizedRequest(method: 'GET', path: '/crm/leads/assignees');
      assignees.assignAll(
        (res as List).map((e) => Map<String, dynamic>.from(e as Map)).toList(),
      );
    } catch (_) {
      assignees.clear();
    }
  }

  String _assigneeLabel(Map<String, dynamic> u) {
    final role = (u['role'] ?? '').toString().toLowerCase();
    final name = (u['name'] ?? '').toString();
    return role == 'manager' ? '$name (Manager)' : name;
  }

  List<Map<String, dynamic>> _salesExecutiveAssignees() {
    return assignees.where((u) {
      final role = (u['role'] ?? '').toString().trim().toLowerCase();
      return role == 'sales executive' || role == 'agent';
    }).toList();
  }

  List<String> _parseTags(String raw) {
    return raw
        .split(RegExp(r'[,\n]'))
        .map((s) => s.trim())
        .where((s) => s.isNotEmpty)
        .toList();
  }

  @override
  void dispose() {
    nameCtrl.dispose();
    companyCtrl.dispose();
    phoneCtrl.dispose();
    emailCtrl.dispose();
    dueDateCtrl.dispose();
    taskDescCtrl.dispose();
    segmentCtrl.dispose();
    jobTitleCtrl.dispose();
    websiteCtrl.dispose();
    addressCtrl.dispose();
    tagsCtrl.dispose();
    notesCtrl.dispose();
    dealSizeCtrl.dispose();
    scoreCtrl.dispose();
    super.dispose();
  }

  Future<void> _saveLeadOnly() async {
    if (nameCtrl.text.trim().isEmpty) {
      Get.snackbar('Missing data', 'Contact name is required');
      return;
    }
    final createdLeadId = await controller.createLead(
      name: nameCtrl.text.trim(),
      email: emailCtrl.text.trim(),
      phone: phoneCtrl.text.trim(),
      company: companyCtrl.text.trim(),
      sourceId: sourceId.value,
      leadSegment: segmentCtrl.text.trim().isEmpty ? null : segmentCtrl.text.trim(),
      jobTitle: jobTitleCtrl.text.trim().isEmpty ? null : jobTitleCtrl.text.trim(),
      website: websiteCtrl.text.trim().isEmpty ? null : websiteCtrl.text.trim(),
      address: addressCtrl.text.trim().isEmpty ? null : addressCtrl.text.trim(),
      stageId: stageId.value,
      assignedTo: assignedTo.value,
      assignedManagerId: assignedManagerId.value,
      priority: priority.value,
      notes: notesCtrl.text.trim().isEmpty ? null : notesCtrl.text.trim(),
      tags: _parseTags(tagsCtrl.text),
      dealSize: double.tryParse(dealSizeCtrl.text.trim()),
      leadScore: double.tryParse(scoreCtrl.text.trim()),
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
    if (nameCtrl.text.trim().isEmpty) {
      Get.snackbar('Missing data', 'Contact name is required');
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
      leadSegment: segmentCtrl.text.trim().isEmpty ? null : segmentCtrl.text.trim(),
      jobTitle: jobTitleCtrl.text.trim().isEmpty ? null : jobTitleCtrl.text.trim(),
      website: websiteCtrl.text.trim().isEmpty ? null : websiteCtrl.text.trim(),
      address: addressCtrl.text.trim().isEmpty ? null : addressCtrl.text.trim(),
      stageId: stageId.value,
      assignedTo: assignedTo.value,
      assignedManagerId: assignedManagerId.value,
      priority: priority.value,
      notes: notesCtrl.text.trim().isEmpty ? null : notesCtrl.text.trim(),
      tags: _parseTags(tagsCtrl.text),
      dealSize: double.tryParse(dealSizeCtrl.text.trim()),
      leadScore: double.tryParse(scoreCtrl.text.trim()),
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
    final canManageTasks = canManageCrmFollowupTasks(Get.find<AuthController>().role.value);
    final role = _auth.role.value.trim().toLowerCase();
    final isSalesManager = role == 'sales manager' || role == 'manager';
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
      fillColor: isDark ? scheme.surfaceContainer : Colors.white,
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
              _sectionLabel(context, 'Qualifiers & contact extra'),
              const SizedBox(height: 6),
              Theme(
                data: Theme.of(context).copyWith(inputDecorationTheme: denseInput),
                child: Column(
                  children: [
                    TextField(
                      controller: segmentCtrl,
                      decoration: InputDecoration(
                        labelText: 'Segment (e.g. B2C, B2B)',
                        hintText: 'B2C',
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
                      controller: jobTitleCtrl,
                      decoration: InputDecoration(
                        labelText: 'Job title / role',
                        hintText: 'House Owner',
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
                      controller: websiteCtrl,
                      keyboardType: TextInputType.url,
                      decoration: InputDecoration(
                        labelText: 'Website',
                        hintText: 'https://',
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
                      controller: addressCtrl,
                      decoration: InputDecoration(
                        labelText: 'Address',
                        floatingLabelBehavior: FloatingLabelBehavior.always,
                        labelStyle: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.w600,
                          color: scheme.onSurfaceVariant,
                        ),
                      ),
                      minLines: 2,
                      maxLines: 4,
                    ),
                    const SizedBox(height: 8),
                    TextField(
                      controller: tagsCtrl,
                      decoration: InputDecoration(
                        labelText: 'Tags',
                        hintText: 'Comma-separated',
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
                      controller: notesCtrl,
                      decoration: InputDecoration(
                        labelText: 'Notes',
                        floatingLabelBehavior: FloatingLabelBehavior.always,
                        labelStyle: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.w600,
                          color: scheme.onSurfaceVariant,
                        ),
                      ),
                      minLines: 2,
                      maxLines: 5,
                    ),
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        Expanded(
                          child: TextField(
                            controller: dealSizeCtrl,
                            keyboardType: const TextInputType.numberWithOptions(decimal: true),
                            decoration: InputDecoration(
                              labelText: 'Deal size (₹)',
                              floatingLabelBehavior: FloatingLabelBehavior.always,
                              labelStyle: TextStyle(
                                fontSize: 10,
                                fontWeight: FontWeight.w600,
                                color: scheme.onSurfaceVariant,
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: TextField(
                            controller: scoreCtrl,
                            keyboardType: const TextInputType.numberWithOptions(decimal: true),
                            decoration: InputDecoration(
                              labelText: 'Lead score',
                              hintText: 'e.g. 2.5',
                              floatingLabelBehavior: FloatingLabelBehavior.always,
                              labelStyle: TextStyle(
                                fontSize: 10,
                                fontWeight: FontWeight.w600,
                                color: scheme.onSurfaceVariant,
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 12),
              _sectionLabel(context, 'Pipeline'),
              const SizedBox(height: 6),
              Theme(
                data: Theme.of(context).copyWith(inputDecorationTheme: denseInput),
                child: Obx(
                  () {
                    final salesExecutiveAssignees = _salesExecutiveAssignees();
                    return Column(
                      children: [
                      DropdownButtonFormField<int?>(
                        value: sourceId.value,
                        decoration: const InputDecoration(labelText: 'Source'),
                        items: [
                          const DropdownMenuItem<int?>(value: null, child: Text('Select…')),
                          ...controller.sources.map((s) => DropdownMenuItem<int?>(value: s.id, child: Text(s.name))),
                        ],
                        onChanged: (v) => sourceId.value = v,
                      ),
                      const SizedBox(height: 8),
                      DropdownButtonFormField<int?>(
                        value: stageId.value,
                        decoration: const InputDecoration(labelText: 'Stage'),
                        items: [
                          const DropdownMenuItem<int?>(value: null, child: Text('Select…')),
                          ...controller.stages.map((s) => DropdownMenuItem<int?>(value: s.id, child: Text(s.name))),
                        ],
                        onChanged: (v) => stageId.value = v,
                      ),
                      const SizedBox(height: 8),
                      DropdownButtonFormField<int?>(
                        value: assignedTo.value,
                        decoration: const InputDecoration(labelText: 'Assign to sales Executive'),
                        items: [
                          const DropdownMenuItem<int?>(value: null, child: Text('Unassigned')),
                          ...salesExecutiveAssignees.map((u) => DropdownMenuItem<int?>(
                                value: int.tryParse('${u['id']}'),
                                child: Text(_assigneeLabel(u)),
                              )),
                        ],
                        onChanged: (v) => assignedTo.value = v,
                      ),
                      if (!isSalesManager) ...[
                        const SizedBox(height: 8),
                        DropdownButtonFormField<int?>(
                          value: assignedManagerId.value,
                          decoration: const InputDecoration(labelText: 'Assign Manager'),
                          items: [
                            const DropdownMenuItem<int?>(value: null, child: Text('Unassigned')),
                            ...assignees.map((u) => DropdownMenuItem<int?>(
                                  value: int.tryParse('${u['id']}'),
                                  child: Text(_assigneeLabel(u)),
                                )),
                          ],
                          onChanged: (v) => assignedManagerId.value = v,
                        ),
                      ],
                      const SizedBox(height: 8),
                      DropdownButtonFormField<String>(
                        value: priority.value,
                        decoration: const InputDecoration(labelText: 'Priority'),
                        items: const [
                          DropdownMenuItem(value: 'hot', child: Text('Hot')),
                          DropdownMenuItem(value: 'warm', child: Text('Warm')),
                          DropdownMenuItem(value: 'cold', child: Text('Cold')),
                        ],
                        onChanged: (v) => priority.value = v ?? 'warm',
                      ),
                      ],
                    );
                  },
                ),
              ),
              if (canManageTasks) ...[
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
              ],
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
                    if (canManageTasks) ...[
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
