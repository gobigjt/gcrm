import 'dart:async';

import 'package:get/get.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/widgets.dart';

import '../../core/models/notification_item.dart';
import '../../core/network/error_utils.dart';
import '../../core/utils/ui_format.dart';
import '../auth/auth_controller.dart';

class NotificationsController extends GetxController with WidgetsBindingObserver {
  final AuthController _auth = Get.find<AuthController>();
  StreamSubscription<RemoteMessage>? _onMessageSub;
  StreamSubscription<RemoteMessage>? _onMessageOpenedSub;

  final errorMessage = ''.obs;
  final isLoading = false.obs;
  final isMutating = false.obs;
  final unreadCount = 0.obs;
  final items = <NotificationItem>[].obs;

  @override
  void onInit() {
    super.onInit();
    WidgetsBinding.instance.addObserver(this);
    _bindPushListeners();
    load();
  }

  @override
  void onClose() {
    WidgetsBinding.instance.removeObserver(this);
    _onMessageSub?.cancel();
    _onMessageOpenedSub?.cancel();
    super.onClose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      // Refresh after app returns to foreground so newly delivered pushes are shown.
      load();
    }
  }

  void _bindPushListeners() {
    _onMessageSub = FirebaseMessaging.onMessage.listen((_) {
      // Foreground push received while app is open.
      load();
    });
    _onMessageOpenedSub = FirebaseMessaging.onMessageOpenedApp.listen((_) {
      // User tapped system notification and returned to app.
      load();
    });
  }

  Future<void> load() async {
    isLoading.value = true;
    errorMessage.value = '';
    try {
      final listRes = await _auth.authorizedRequest(method: 'GET', path: '/notifications');
      final unreadRes = await _auth.authorizedRequest(method: 'GET', path: '/notifications/unread-count');
      items.assignAll((listRes as List).map((e) => NotificationItem.fromJson(Map<String, dynamic>.from(e as Map))));
      unreadCount.value = parseDynamicInt((unreadRes as Map)['count']);
    } catch (e) {
      errorMessage.value = userFriendlyError(e);
    } finally {
      isLoading.value = false;
    }
  }

  Future<void> markRead(int id) async {
    isMutating.value = true;
    try {
      await _auth.authorizedRequest(method: 'PATCH', path: '/notifications/$id/read');
      await load();
    } finally {
      isMutating.value = false;
    }
  }

  Future<void> markAllRead() async {
    isMutating.value = true;
    try {
      await _auth.authorizedRequest(method: 'PATCH', path: '/notifications/read-all');
      await load();
    } finally {
      isMutating.value = false;
    }
  }

  Future<void> clearRead() async {
    isMutating.value = true;
    try {
      await _auth.authorizedRequest(method: 'DELETE', path: '/notifications/read');
      await load();
    } finally {
      isMutating.value = false;
    }
  }
}
