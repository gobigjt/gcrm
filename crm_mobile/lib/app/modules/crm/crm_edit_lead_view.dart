import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../../core/models/crm_models.dart';
import '../../core/network/error_utils.dart';
import '../auth/auth_controller.dart';
import 'crm_controller.dart';
import 'crm_lead_detail_controller.dart';

/// Full-screen edit form; PATCH `/crm/leads/:id` then refreshes detail + list if registered.
class CrmEditLeadView extends StatefulWidget {
  const CrmEditLeadView({super.key, required this.leadId});

  final int leadId;

  @override
  State<CrmEditLeadView> createState() => _CrmEditLeadViewState();
}

class _CrmEditLeadViewState extends State<CrmEditLeadView> {
  final _auth = Get.find<AuthController>();

  bool _loading = true;
  String? _loadError;
  bool _saving = false;

  List<CrmLookupItem> _stages = [];
  List<CrmLookupItem> _sources = [];
  List<CrmLookupItem> _assignees = [];

  final _name = TextEditingController();
  final _company = TextEditingController();
  final _phone = TextEditingController();
  final _email = TextEditingController();
  final _segment = TextEditingController();
  final _jobTitle = TextEditingController();
  final _website = TextEditingController();
  final _address = TextEditingController();
  final _tags = TextEditingController();
  final _notes = TextEditingController();
  final _dealSize = TextEditingController();
  final _score = TextEditingController();

  int? _sourceId;
  int? _stageId;
  int? _assignedTo;
  int? _assignedManagerId;
  String _priority = 'warm';

  @override
  void dispose() {
    _name.dispose();
    _company.dispose();
    _phone.dispose();
    _email.dispose();
    _segment.dispose();
    _jobTitle.dispose();
    _website.dispose();
    _address.dispose();
    _tags.dispose();
    _notes.dispose();
    _dealSize.dispose();
    _score.dispose();
    super.dispose();
  }

  List<String> _parseTags(String raw) {
    return raw
        .split(RegExp(r'[,\n]'))
        .map((s) => s.trim())
        .where((s) => s.isNotEmpty)
        .toList();
  }

  @override
  void initState() {
    super.initState();
    _bootstrap();
  }

  Future<void> _bootstrap() async {
    setState(() {
      _loading = true;
      _loadError = null;
    });
    try {
      final leadRes = await _auth.authorizedRequest(method: 'GET', path: '/crm/leads/${widget.leadId}');
      final stagesRes = await _auth.authorizedRequest(method: 'GET', path: '/crm/leads/stages');
      final sourcesRes = await _auth.authorizedRequest(method: 'GET', path: '/crm/leads/sources');
      final assignRes = await _auth.authorizedRequest(method: 'GET', path: '/crm/leads/assignees');

      final leadMap = Map<String, dynamic>.from((leadRes as Map)['lead'] as Map);
      final lead = CrmLead.fromJson(leadMap);

      _stages = (stagesRes as List).map((e) => CrmLookupItem.fromJson(Map<String, dynamic>.from(e as Map))).toList();
      _sources = (sourcesRes as List).map((e) => CrmLookupItem.fromJson(Map<String, dynamic>.from(e as Map))).toList();
      _assignees = (assignRes as List).map((e) => CrmLookupItem.fromJson(Map<String, dynamic>.from(e as Map))).toList();

      _name.text = lead.name;
      _company.text = lead.company;
      _phone.text = lead.phone;
      _email.text = lead.email;
      _segment.text = lead.leadSegment;
      _jobTitle.text = lead.jobTitle;
      _website.text = lead.website;
      _address.text = lead.address;
      _tags.text = lead.tags.join(', ');
      _notes.text = lead.notes;
      if (lead.dealSize != null) {
        final d = lead.dealSize!;
        _dealSize.text = d == d.roundToDouble() ? d.round().toString() : d.toString();
      }
      _score.text = lead.leadScore == 0 ? '' : lead.leadScore.toString();
      _sourceId = lead.sourceId;
      _stageId = lead.stageId;
      _assignedTo = lead.assignedTo;
      _assignedManagerId = lead.assignedManagerId;
      _priority = lead.priority;
    } catch (e) {
      _loadError = userFriendlyError(e);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Map<String, dynamic> _buildBody() {
    final tags = _parseTags(_tags.text);
    final dealRaw = _dealSize.text.trim();
    final scoreRaw = _score.text.trim();
    final body = <String, dynamic>{
      'name': _name.text.trim(),
      'email': _email.text.trim().isEmpty ? null : _email.text.trim(),
      'phone': _phone.text.trim().isEmpty ? null : _phone.text.trim(),
      'company': _company.text.trim().isEmpty ? null : _company.text.trim(),
      'source_id': _sourceId,
      'stage_id': _stageId,
      'assigned_to': _assignedTo,
      'assigned_manager_id': _assignedManagerId,
      'priority': _priority,
      'notes': _notes.text.trim().isEmpty ? null : _notes.text.trim(),
      'lead_segment': _segment.text.trim().isEmpty ? null : _segment.text.trim(),
      'job_title': _jobTitle.text.trim().isEmpty ? null : _jobTitle.text.trim(),
      'website': _website.text.trim().isEmpty ? null : _website.text.trim(),
      'address': _address.text.trim().isEmpty ? null : _address.text.trim(),
      'tags': tags,
      'deal_size': dealRaw.isEmpty ? null : num.tryParse(dealRaw),
      // NOT NULL column; empty field → 0
      'lead_score': scoreRaw.isEmpty ? 0 : (num.tryParse(scoreRaw) ?? 0),
    };
    return body;
  }

  Future<void> _save() async {
    if (_name.text.trim().isEmpty) {
      Get.snackbar('Missing data', 'Name is required');
      return;
    }
    setState(() => _saving = true);
    try {
      await _auth.authorizedRequest(
        method: 'PATCH',
        path: '/crm/leads/${widget.leadId}',
        body: _buildBody(),
      );
      final tag = 'lead-${widget.leadId}';
      if (Get.isRegistered<CrmLeadDetailController>(tag: tag)) {
        await Get.find<CrmLeadDetailController>(tag: tag).load();
      }
      if (Get.isRegistered<CrmController>()) {
        await Get.find<CrmController>().applyFilters();
      }
      if (mounted) Navigator.of(context).pop();
      Get.snackbar('Saved', 'Lead updated');
    } catch (e) {
      Get.snackbar('Error', userFriendlyError(e));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
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
      fillColor: isDark ? scheme.surfaceContainer : Colors.white,
      contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 11),
      border: border,
      enabledBorder: border,
      focusedBorder: border.copyWith(
        borderSide: BorderSide(color: scheme.primary, width: 1.4),
      ),
    );

    return Scaffold(
      appBar: AppBar(
        leadingWidth: 86,
        leading: TextButton(
          onPressed: _saving ? null : () => Navigator.of(context).maybePop(),
          style: TextButton.styleFrom(
            foregroundColor: const Color(0xFF185FA5),
            alignment: Alignment.centerLeft,
            padding: const EdgeInsets.only(left: 8, right: 4),
          ),
          child: const Text('< Back', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
        ),
        titleSpacing: 0,
        title: const Text('Edit lead', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700)),
        centerTitle: false,
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _loadError != null
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Text(_loadError!, textAlign: TextAlign.center),
                        const SizedBox(height: 16),
                        FilledButton(onPressed: _bootstrap, child: const Text('Retry')),
                      ],
                    ),
                  ),
                )
              : SafeArea(
                  child: SingleChildScrollView(
                    padding: const EdgeInsets.all(16),
                    child: Theme(
                      data: Theme.of(context).copyWith(inputDecorationTheme: denseInput),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          _section(context, 'Contact'),
                          TextField(
                            controller: _name,
                            decoration: _dec(scheme, 'Name *', 'Full name'),
                          ),
                          const SizedBox(height: 8),
                          TextField(
                            controller: _company,
                            decoration: _dec(scheme, 'Company', null),
                          ),
                          const SizedBox(height: 8),
                          TextField(
                            controller: _phone,
                            decoration: _dec(scheme, 'Phone *', '+91 …'),
                          ),
                          const SizedBox(height: 8),
                          TextField(
                            controller: _email,
                            keyboardType: TextInputType.emailAddress,
                            decoration: _dec(scheme, 'Email', null),
                          ),
                          const SizedBox(height: 14),
                          _section(context, 'Pipeline'),
                          DropdownButtonFormField<int?>(
                            value: _stageId,
                            decoration: _dec(scheme, 'Stage', null),
                            items: [
                              const DropdownMenuItem<int?>(value: null, child: Text('Unassigned')),
                              ..._stages.map((s) => DropdownMenuItem<int?>(value: s.id, child: Text(s.name))),
                            ],
                            onChanged: _saving ? null : (v) => setState(() => _stageId = v),
                          ),
                          const SizedBox(height: 8),
                          DropdownButtonFormField<int?>(
                            value: _sourceId,
                            decoration: _dec(scheme, 'Source', null),
                            items: [
                              const DropdownMenuItem<int?>(value: null, child: Text('None')),
                              ..._sources.map((s) => DropdownMenuItem<int?>(value: s.id, child: Text(s.name))),
                            ],
                            onChanged: _saving ? null : (v) => setState(() => _sourceId = v),
                          ),
                          const SizedBox(height: 8),
                          DropdownButtonFormField<int?>(
                            value: _assignedTo,
                            decoration: _dec(scheme, 'Assigned to', null),
                            items: [
                              const DropdownMenuItem<int?>(value: null, child: Text('Unassigned')),
                              ..._assignees.map((u) => DropdownMenuItem<int?>(value: u.id, child: Text(u.name))),
                            ],
                            onChanged: _saving ? null : (v) => setState(() => _assignedTo = v),
                          ),
                          const SizedBox(height: 8),
                          DropdownButtonFormField<int?>(
                            value: _assignedManagerId,
                            decoration: _dec(scheme, 'Assign Manager', null),
                            items: [
                              const DropdownMenuItem<int?>(value: null, child: Text('Unassigned')),
                              ..._assignees.map((u) => DropdownMenuItem<int?>(value: u.id, child: Text(u.name))),
                            ],
                            onChanged: _saving ? null : (v) => setState(() => _assignedManagerId = v),
                          ),
                          const SizedBox(height: 8),
                          DropdownButtonFormField<String>(
                            value: _priority,
                            decoration: _dec(scheme, 'Priority', null),
                            items: const [
                              DropdownMenuItem(value: 'hot', child: Text('Hot')),
                              DropdownMenuItem(value: 'warm', child: Text('Warm')),
                              DropdownMenuItem(value: 'cold', child: Text('Cold')),
                            ],
                            onChanged: _saving ? null : (v) => setState(() => _priority = v ?? 'warm'),
                          ),
                          const SizedBox(height: 14),
                          _section(context, 'Qualifiers & extras'),
                          TextField(
                            controller: _segment,
                            decoration: _dec(scheme, 'Segment', 'B2C / B2B'),
                          ),
                          const SizedBox(height: 8),
                          TextField(
                            controller: _jobTitle,
                            decoration: _dec(scheme, 'Job title', null),
                          ),
                          const SizedBox(height: 8),
                          TextField(
                            controller: _website,
                            keyboardType: TextInputType.url,
                            decoration: _dec(scheme, 'Website', 'https://'),
                          ),
                          const SizedBox(height: 8),
                          TextField(
                            controller: _address,
                            minLines: 2,
                            maxLines: 4,
                            decoration: _dec(scheme, 'Address', null),
                          ),
                          const SizedBox(height: 8),
                          TextField(
                            controller: _tags,
                            decoration: _dec(scheme, 'Tags', 'Comma-separated'),
                          ),
                          const SizedBox(height: 8),
                          TextField(
                            controller: _notes,
                            minLines: 2,
                            maxLines: 5,
                            decoration: _dec(scheme, 'Notes', null),
                          ),
                          const SizedBox(height: 8),
                          Row(
                            children: [
                              Expanded(
                                child: TextField(
                                  controller: _dealSize,
                                  keyboardType: const TextInputType.numberWithOptions(decimal: true),
                                  decoration: _dec(scheme, 'Deal size (INR)', null),
                                ),
                              ),
                              const SizedBox(width: 10),
                              Expanded(
                                child: TextField(
                                  controller: _score,
                                  keyboardType: const TextInputType.numberWithOptions(decimal: true),
                                  decoration: _dec(scheme, 'Lead score', 'e.g. 2.5'),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 22),
                          FilledButton(
                            onPressed: _saving ? null : _save,
                            style: FilledButton.styleFrom(
                              backgroundColor: const Color(0xFF185FA5),
                              foregroundColor: Colors.white,
                              padding: const EdgeInsets.symmetric(vertical: 12),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                            ),
                            child: _saving
                                ? const SizedBox(
                                    width: 22,
                                    height: 22,
                                    child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                                  )
                                : const Text('Save changes'),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
    );
  }

  InputDecoration _dec(ColorScheme scheme, String label, String? hint) {
    return InputDecoration(
      labelText: label,
      hintText: hint,
      floatingLabelBehavior: FloatingLabelBehavior.always,
      labelStyle: TextStyle(
        fontSize: 10,
        fontWeight: FontWeight.w600,
        color: scheme.onSurfaceVariant,
      ),
    );
  }

  Widget _section(BuildContext context, String t) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Text(
        t.toUpperCase(),
        style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: Theme.of(context).hintColor,
              fontWeight: FontWeight.w600,
              letterSpacing: 0.4,
            ),
      ),
    );
  }
}
