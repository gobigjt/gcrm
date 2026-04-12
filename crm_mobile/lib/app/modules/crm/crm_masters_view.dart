import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../auth/auth_controller.dart';
import '../../core/network/error_utils.dart';

/// CRM Masters — manage Sources, Segments, and Priority labels.
/// Mirrors web `CRMMastersPage.jsx` (tabs: Sources | Segments | Priority).
class CrmMastersView extends StatefulWidget {
  const CrmMastersView({super.key});

  @override
  State<CrmMastersView> createState() => _CrmMastersViewState();
}

class _CrmMastersViewState extends State<CrmMastersView> with SingleTickerProviderStateMixin {
  late final TabController _tabs;

  @override
  void initState() {
    super.initState();
    _tabs = TabController(length: 3, vsync: this);
  }

  @override
  void dispose() {
    _tabs.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final cs    = Theme.of(context).colorScheme;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      appBar: AppBar(
        backgroundColor: isDark ? cs.surfaceContainerHigh : const Color(0xFF263238),
        foregroundColor: isDark ? cs.onSurface : Colors.white,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        title: Text('CRM Masters',
            style: TextStyle(
              color: isDark ? cs.onSurface : Colors.white,
              fontWeight: FontWeight.w700,
              fontSize: 18,
            )),
        iconTheme: IconThemeData(color: isDark ? cs.onSurface : Colors.white),
        bottom: TabBar(
          controller: _tabs,
          labelColor: isDark ? cs.primary : Colors.white,
          unselectedLabelColor: isDark ? cs.onSurfaceVariant : Colors.white70,
          indicatorColor: isDark ? cs.primary : Colors.white,
          labelStyle: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13),
          tabs: const [
            Tab(text: 'Sources'),
            Tab(text: 'Segments'),
            Tab(text: 'Priority'),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabs,
        children: const [
          _MasterTab(apiPath: '/crm/leads/masters/sources',    hasPriority: false),
          _MasterTab(apiPath: '/crm/leads/masters/segments',   hasPriority: false),
          _MasterTab(apiPath: '/crm/leads/masters/priorities', hasPriority: true),
        ],
      ),
    );
  }
}

// ─── Single tab ───────────────────────────────────────────────────────────────

class _MasterTab extends StatefulWidget {
  const _MasterTab({required this.apiPath, required this.hasPriority});

  final String apiPath;
  final bool   hasPriority;

  @override
  State<_MasterTab> createState() => _MasterTabState();
}

class _MasterTabState extends State<_MasterTab> with AutomaticKeepAliveClientMixin {
  final AuthController _auth = Get.find<AuthController>();

  List<Map<String, dynamic>> _items  = [];
  bool   _loading  = true;
  bool   _saving   = false;
  String _error    = '';
  int?   _editId;

  final _nameCtrl  = TextEditingController();
  String _color    = '';

  static const _colorOptions = [
    ('red',    '🔴 Red'),
    ('amber',  '🟡 Amber'),
    ('blue',   '🔵 Blue'),
    ('green',  '🟢 Green'),
    ('violet', '🟣 Violet'),
    ('slate',  '⚫ Slate'),
  ];

  @override
  bool get wantKeepAlive => true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = ''; });
    try {
      final res = await _auth.authorizedRequest(method: 'GET', path: widget.apiPath);
      setState(() {
        _items = (res as List? ?? [])
            .map((e) => Map<String, dynamic>.from(e as Map))
            .toList();
      });
    } catch (e) {
      setState(() { _error = userFriendlyError(e); });
    } finally {
      setState(() { _loading = false; });
    }
  }

  void _startEdit(Map<String, dynamic> item) {
    _editId      = (item['id'] as num?)?.toInt();
    _nameCtrl.text = (item['name'] ?? '').toString();
    _color       = (item['color'] ?? '').toString();
    _showForm(context);
  }

  void _startAdd() {
    _editId = null;
    _nameCtrl.clear();
    _color = '';
    _showForm(context);
  }

  Future<void> _save() async {
    final name = _nameCtrl.text.trim();
    if (name.isEmpty) {
      Get.snackbar('Validation', 'Name is required.');
      return;
    }
    setState(() { _saving = true; });
    try {
      final body = <String, dynamic>{
        'name': name,
        if (widget.hasPriority && _color.isNotEmpty) 'color': _color,
      };
      if (_editId != null) {
        await _auth.authorizedRequest(method: 'PUT', path: '${widget.apiPath}/$_editId', body: body);
      } else {
        await _auth.authorizedRequest(method: 'POST', path: widget.apiPath, body: body);
      }
      if (mounted) Navigator.of(context).pop();
      await _load();
    } catch (e) {
      Get.snackbar('Save failed', userFriendlyError(e));
    } finally {
      setState(() { _saving = false; });
    }
  }

  Future<void> _delete(int id) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete'),
        content: const Text('Delete this item?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Delete', style: TextStyle(color: Colors.red)),
          ),
        ],
      ),
    );
    if (confirm != true) return;
    try {
      await _auth.authorizedRequest(method: 'DELETE', path: '${widget.apiPath}/$id');
      await _load();
    } catch (e) {
      Get.snackbar('Delete failed', userFriendlyError(e));
    }
  }

  void _showForm(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Theme.of(context).colorScheme.surfaceContainerHigh,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setSheet) {
          final cs    = Theme.of(ctx).colorScheme;
          final isDark = Theme.of(ctx).brightness == Brightness.dark;
          return Padding(
            padding: EdgeInsets.fromLTRB(16, 16, 16, MediaQuery.of(ctx).viewInsets.bottom + 24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(_editId != null ? 'Edit' : 'Add new',
                    style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16, color: cs.onSurface)),
                const SizedBox(height: 14),
                TextField(
                  controller: _nameCtrl,
                  autofocus: true,
                  style: TextStyle(color: cs.onSurface),
                  decoration: InputDecoration(
                    labelText: 'Name',
                    filled: true,
                    fillColor: cs.surfaceContainer,
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(10),
                      borderSide: BorderSide(color: cs.outlineVariant),
                    ),
                  ),
                ),
                if (widget.hasPriority) ...[
                  const SizedBox(height: 12),
                  Text('Colour', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: cs.onSurfaceVariant)),
                  const SizedBox(height: 6),
                  Wrap(
                    spacing: 8,
                    runSpacing: 6,
                    children: _colorOptions.map(((String, String) opt) {
                      final (val, lbl) = opt;
                      final active = _color == val;
                      return GestureDetector(
                        onTap: () => setSheet(() => _color = val),
                        child: AnimatedContainer(
                          duration: const Duration(milliseconds: 120),
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
                          decoration: BoxDecoration(
                            color: active
                                ? (isDark ? cs.primary.withValues(alpha: 0.2) : cs.primary.withValues(alpha: 0.1))
                                : cs.surfaceContainer,
                            border: Border.all(
                              color: active ? cs.primary : cs.outlineVariant,
                              width: active ? 1.8 : 1,
                            ),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Text(lbl, style: TextStyle(fontSize: 13, color: cs.onSurface)),
                        ),
                      );
                    }).toList(),
                  ),
                ],
                const SizedBox(height: 20),
                FilledButton(
                  onPressed: _saving ? null : _save,
                  child: _saving
                      ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2.5, color: Colors.white))
                      : Text(_editId != null ? 'Save changes' : 'Add',
                            style: const TextStyle(fontWeight: FontWeight.w700)),
                ),
              ],
            ),
          );
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    super.build(context);
    final cs    = Theme.of(context).colorScheme;
    final isDark = Theme.of(context).brightness == Brightness.dark;

    if (_loading) return const Center(child: CircularProgressIndicator());
    if (_error.isNotEmpty) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(_error, textAlign: TextAlign.center),
            const SizedBox(height: 12),
            FilledButton(onPressed: _load, child: const Text('Retry')),
          ],
        ),
      );
    }

    return Stack(
      children: [
        _items.isEmpty
            ? Center(
                child: Text('No items yet. Tap + to add.',
                    style: TextStyle(color: cs.onSurfaceVariant, fontSize: 14)))
            : ListView.separated(
                padding: const EdgeInsets.fromLTRB(12, 12, 12, 80),
                itemCount: _items.length,
                separatorBuilder: (_, __) => const SizedBox(height: 6),
                itemBuilder: (_, i) {
                  final item  = _items[i];
                  final id    = (item['id'] as num?)?.toInt() ?? 0;
                  final name  = (item['name'] ?? '').toString();
                  final color = (item['color'] ?? '').toString();
                  return Card(
                    margin: EdgeInsets.zero,
                    color: cs.surfaceContainer,
                    elevation: isDark ? 0 : 1,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                      side: BorderSide(color: isDark ? cs.outlineVariant : Colors.grey.shade300),
                    ),
                    child: ListTile(
                      leading: widget.hasPriority && color.isNotEmpty
                          ? CircleAvatar(
                              radius: 14,
                              backgroundColor: _colorToMaterial(color).withValues(alpha: 0.2),
                              child: Text(_colorEmoji(color), style: const TextStyle(fontSize: 14)),
                            )
                          : CircleAvatar(
                              radius: 14,
                              backgroundColor: cs.primary.withValues(alpha: 0.12),
                              child: Text(name.isNotEmpty ? name[0].toUpperCase() : '?',
                                  style: TextStyle(color: cs.primary, fontWeight: FontWeight.w700, fontSize: 13)),
                            ),
                      title: Text(name, style: TextStyle(fontWeight: FontWeight.w600, color: cs.onSurface)),
                      trailing: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          IconButton(
                            icon: Icon(Icons.edit_outlined, size: 20, color: cs.primary),
                            onPressed: () => _startEdit(item),
                          ),
                          IconButton(
                            icon: const Icon(Icons.delete_outline, size: 20, color: Color(0xFFE53935)),
                            onPressed: () => _delete(id),
                          ),
                        ],
                      ),
                    ),
                  );
                },
              ),
        Positioned(
          bottom: 16,
          right: 16,
          child: FloatingActionButton(
            heroTag: widget.apiPath,
            backgroundColor: const Color(0xFF26A69A),
            foregroundColor: Colors.white,
            onPressed: _startAdd,
            child: const Icon(Icons.add),
          ),
        ),
      ],
    );
  }

  Color _colorToMaterial(String c) {
    return switch (c) {
      'red'    => Colors.red,
      'amber'  => Colors.amber,
      'blue'   => Colors.blue,
      'green'  => Colors.green,
      'violet' => Colors.purple,
      _        => Colors.blueGrey,
    };
  }

  String _colorEmoji(String c) {
    return switch (c) {
      'red'    => '🔴',
      'amber'  => '🟡',
      'blue'   => '🔵',
      'green'  => '🟢',
      'violet' => '🟣',
      _        => '⚫',
    };
  }
}
