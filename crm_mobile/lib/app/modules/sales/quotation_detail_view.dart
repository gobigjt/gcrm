import 'package:flutter/material.dart';

import 'sales_document_detail_view.dart';
import 'sales_document_kind.dart';

/// Opens the unified sales document detail screen for a quotation.
class QuotationDetailView extends StatelessWidget {
  const QuotationDetailView({super.key, required this.quotationId});

  final int quotationId;

  @override
  Widget build(BuildContext context) {
    return SalesDocumentDetailView(kind: SalesDocumentKind.quotation, documentId: quotationId);
  }
}
