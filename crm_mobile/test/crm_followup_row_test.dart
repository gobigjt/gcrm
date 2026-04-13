import 'package:flutter_test/flutter_test.dart';

import 'package:ezcrm/app/core/models/crm_models.dart';

void main() {
  test('CrmFollowupRow tolerates string lead_score from NUMERIC column', () {
    final row = CrmFollowupRow.fromJson({
      'id': 1,
      'lead_id': 2,
      'description': 'Call back',
      'due_date': '2026-04-13T10:00:00.000Z',
      'is_done': false,
      'lead_score': '7.50',
      'lead_name': 'Acme',
      'lead_stage': 'Qualified',
    });
    expect(row.leadScore, 7);
  });
}
