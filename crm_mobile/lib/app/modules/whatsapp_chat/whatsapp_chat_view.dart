import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../../core/utils/ui_format.dart';
import '../../shared/widgets/app_error_banner.dart';
import '../auth/auth_controller.dart';
import 'whatsapp_chat_controller.dart';

class WhatsAppChatView extends StatefulWidget {
  const WhatsAppChatView({super.key});

  @override
  State<WhatsAppChatView> createState() => _WhatsAppChatViewState();
}

class _WhatsAppChatViewState extends State<WhatsAppChatView> {
  final _msgCtrl = TextEditingController();
  final _scrollCtrl = ScrollController();
  int _lastMessageCount = 0;

  DateTime? _parseTs(dynamic v) {
    if (v == null) return null;
    return DateTime.tryParse(v.toString());
  }

  String _timeHHmm(dynamic v) {
    final d = _parseTs(v);
    if (d == null) return '—';
    final hh = d.hour.toString().padLeft(2, '0');
    final mm = d.minute.toString().padLeft(2, '0');
    return '$hh:$mm';
  }

  String _dayLabel(dynamic v) {
    final d = _parseTs(v);
    if (d == null) return '';
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final day = DateTime(d.year, d.month, d.day);
    final diff = today.difference(day).inDays;
    if (diff == 0) return 'Today';
    if (diff == 1) return 'Yesterday';
    return formatIsoDate(v);
  }

  String _ticks(String status) {
    final s = status.toLowerCase();
    if (s == 'queued') return '✓';
    if (s == 'sent') return '✓✓';
    if (s == 'failed') return '!';
    return '';
  }

  @override
  void dispose() {
    _msgCtrl.dispose();
    _scrollCtrl.dispose();
    super.dispose();
  }

  void _scrollToLatest({bool animated = true}) {
    if (!_scrollCtrl.hasClients) return;
    // Because ListView is reverse:true, offset 0 is the "bottom/latest" position.
    if (animated) {
      _scrollCtrl.animateTo(
        0,
        duration: const Duration(milliseconds: 220),
        curve: Curves.easeOut,
      );
    } else {
      _scrollCtrl.jumpTo(0);
    }
  }

  String _initials(String name) {
    final parts = name.trim().split(RegExp(r'\s+')).where((p) => p.isNotEmpty).toList();
    if (parts.isEmpty) return '?';
    if (parts.length == 1) {
      final t = parts.first;
      return t.length >= 2 ? t.substring(0, 2).toUpperCase() : t.substring(0, 1).toUpperCase();
    }
    return (parts[0].substring(0, 1) + parts[1].substring(0, 1)).toUpperCase();
  }

  Future<void> _openTemplatePicker(WhatsAppChatController controller) async {
    final list = controller.templates;
    if (list.isEmpty) {
      Get.snackbar('No templates', 'No WhatsApp templates found.');
      return;
    }

    final selectedBody = await showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      builder: (_) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Templates', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800)),
              const SizedBox(height: 10),
              Flexible(
                child: ListView.separated(
                  shrinkWrap: true,
                  itemCount: list.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 8),
                  itemBuilder: (_, i) {
                    final t = list[i];
                    return Card(
                      child: ListTile(
                        title: Text(t.name),
                        subtitle: Text(t.bodyPreview, maxLines: 3, overflow: TextOverflow.ellipsis),
                        onTap: () => Navigator.of(context).pop(t.body),
                      ),
                    );
                  },
                ),
              ),
            ],
          ),
        ),
      ),
    );

    if (selectedBody == null || selectedBody.trim().isEmpty) return;
    final cur = _msgCtrl.text.trimRight();
    _msgCtrl.text = cur.isEmpty ? selectedBody : '$cur\n$selectedBody';
    _msgCtrl.selection = TextSelection.fromPosition(TextPosition(offset: _msgCtrl.text.length));
  }

  @override
  Widget build(BuildContext context) {
    final auth = Get.find<AuthController>();
    final controller = Get.find<WhatsAppChatController>();

    return Scaffold(
      appBar: AppBar(
        leading: IconButton(onPressed: () => Get.back(), icon: const Icon(Icons.arrow_back_rounded)),
        title: Obx(() {
          final lead = controller.lead.value;
          final title = (lead?.company ?? '').trim().isEmpty ? (lead?.name ?? 'Chat') : lead!.company;
          final phone = (lead?.phone ?? '').trim();
          return Row(
            children: [
              CircleAvatar(
                radius: 13,
                backgroundColor: const Color(0xFFEEEDFE),
                child: Text(
                  _initials(title),
                  style: const TextStyle(fontSize: 9, fontWeight: FontWeight.w800, color: Color(0xFF3C3489)),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(title, style: Theme.of(context).textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w700)),
                    if (phone.isNotEmpty)
                      Text(phone, style: Theme.of(context).textTheme.bodySmall?.copyWith(color: Theme.of(context).hintColor)),
                  ],
                ),
              ),
            ],
          );
        }),
        actions: [
          IconButton(onPressed: controller.load, icon: const Icon(Icons.refresh_rounded), tooltip: 'Refresh'),
        ],
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
            child: Obx(
              () => AppErrorBanner(
                message: controller.errorMessage.value,
                onRetry: controller.load,
              ),
            ),
          ),
          Expanded(
            child: Obx(() {
              if (controller.isLoading.value && controller.messages.isEmpty) {
                return const Center(child: CircularProgressIndicator());
              }
              if (controller.messages.isEmpty) {
                return RefreshIndicator(
                  onRefresh: () async => controller.load(),
                  child: ListView(
                    physics: const AlwaysScrollableScrollPhysics(),
                    children: [
                      SizedBox(height: MediaQuery.of(context).size.height * 0.25),
                      const Center(child: Text('No messages yet')),
                    ],
                  ),
                );
              }

              final count = controller.messages.length;
              if (count != _lastMessageCount) {
                _lastMessageCount = count;
                WidgetsBinding.instance.addPostFrameCallback((_) => _scrollToLatest(animated: false));
              }

              return RefreshIndicator(
                onRefresh: () async => controller.load(),
                child: ListView.separated(
                reverse: true,
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
                controller: _scrollCtrl,
                itemCount: controller.messages.length,
                separatorBuilder: (_, __) => const SizedBox(height: 6),
                itemBuilder: (_, i) {
                  final msg = controller.messages[controller.messages.length - 1 - i];
                  final msgTs = _parseTs(msg.sentAt);
                  final prev = (controller.messages.length - 1 - i) > 0
                      ? controller.messages[controller.messages.length - 1 - i - 1]
                      : null;
                  final prevTs = prev == null ? null : _parseTs(prev.sentAt);
                  final dayChanged = msgTs != null &&
                      (prevTs == null ||
                          msgTs.year != prevTs.year ||
                          msgTs.month != prevTs.month ||
                          msgTs.day != prevTs.day);

                  final isMe = msg.sentByName.trim().isNotEmpty && msg.sentByName.trim() == auth.userName.value.trim();
                  final isDark = Theme.of(context).brightness == Brightness.dark;
                  final bubbleBg = isMe
                      ? const Color(0xFF185FA5)
                      : (isDark ? const Color(0xFF1F2937) : const Color(0xFFF3F4F6));
                  final bubbleFg = isMe ? Colors.white : Theme.of(context).textTheme.bodyMedium?.color ?? Colors.black;

                  return Column(
                    children: [
                      if (dayChanged)
                        Padding(
                          padding: const EdgeInsets.symmetric(vertical: 6),
                          child: Center(
                            child: Text(
                              _dayLabel(msg.sentAt),
                              style: Theme.of(context).textTheme.bodySmall?.copyWith(color: Theme.of(context).hintColor),
                            ),
                          ),
                        ),
                      Align(
                        alignment: isMe ? Alignment.centerRight : Alignment.centerLeft,
                        child: ConstrainedBox(
                          constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.78),
                          child: DecoratedBox(
                            decoration: BoxDecoration(color: bubbleBg, borderRadius: BorderRadius.circular(16)),
                            child: Padding(
                              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                              child: Column(
                                crossAxisAlignment: isMe ? CrossAxisAlignment.end : CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    msg.body.isEmpty ? '—' : msg.body,
                                    style: TextStyle(color: bubbleFg),
                                  ),
                                  const SizedBox(height: 6),
                                  Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      Text(
                                        _timeHHmm(msg.sentAt),
                                        style: TextStyle(color: bubbleFg.withValues(alpha: 0.75), fontSize: 11),
                                      ),
                                      if (isMe) ...[
                                        const SizedBox(width: 6),
                                        Text(
                                          _ticks(msg.status),
                                          style: TextStyle(
                                            color: bubbleFg.withValues(alpha: 0.85),
                                            fontSize: 11,
                                            fontWeight: FontWeight.w700,
                                          ),
                                        ),
                                      ],
                                    ],
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ),
                      ),
                    ],
                  );
                },
              ),
              );
            }),
          ),
          SafeArea(
            top: false,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
              child: Row(
                children: [
                  InkWell(
                    onTap: () => _openTemplatePicker(controller),
                    borderRadius: BorderRadius.circular(10),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
                      decoration: BoxDecoration(
                        border: Border.all(color: const Color(0xFF185FA5), width: 0.5),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: const Text(
                        'Template',
                        style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF185FA5)),
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: TextField(
                      controller: _msgCtrl,
                      decoration: const InputDecoration(
                        hintText: 'Type a message…',
                        contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                        border: OutlineInputBorder(),
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Obx(
                    () => IconButton(
                      onPressed: controller.isSubmitting.value
                          ? null
                          : () async {
                              final text = _msgCtrl.text;
                              _msgCtrl.clear();
                              await controller.sendMessage(text);
                              _scrollToLatest(animated: true);
                            },
                      icon: Container(
                        width: 36,
                        height: 36,
                        decoration: const BoxDecoration(color: Color(0xFF185FA5), shape: BoxShape.circle),
                        child: controller.isSubmitting.value
                            ? const Padding(
                                padding: EdgeInsets.all(10),
                                child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                              )
                            : const Icon(Icons.send_rounded, size: 18, color: Colors.white),
                      ),
                      tooltip: 'Send',
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

