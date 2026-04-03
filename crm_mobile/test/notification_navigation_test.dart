import 'package:flutter_test/flutter_test.dart';

import 'package:ezcrm/app/core/navigation/notification_navigation.dart';

void main() {
  test('parseLeadIdFromNotificationLink handles query and path', () {
    expect(parseLeadIdFromNotificationLink('/crm?lead=42'), 42);
    expect(parseLeadIdFromNotificationLink('https://app.example/crm?lead=7'), 7);
    expect(parseLeadIdFromNotificationLink('/lead/99'), 99);
    expect(parseLeadIdFromNotificationLink('x/lead/3?foo=1'), 3);
    expect(parseLeadIdFromNotificationLink('ezcrm://app/crm?lead=55'), 55);
    expect(parseLeadIdFromNotificationLink('ezcrm://host/lead/12'), 12);
    expect(parseLeadIdFromNotificationLink(null), null);
    expect(parseLeadIdFromNotificationLink(''), null);
  });
}
