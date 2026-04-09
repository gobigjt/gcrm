import '../auth/auth_controller.dart';
import '../../core/storage/save_pdf.dart';
import 'sales_document_kind.dart';
import 'sales_document_pdf_builder.dart';

class SalesDocumentPdfService {
  SalesDocumentPdfService._();

  static String _detailPath(SalesDocumentKind kind, int id) {
    return switch (kind) {
      SalesDocumentKind.quotation => '/sales/quotations/$id',
      SalesDocumentKind.order => '/sales/orders/$id',
      SalesDocumentKind.invoice => '/sales/invoices/$id',
    };
  }

  static String _responseKey(SalesDocumentKind kind) {
    return switch (kind) {
      SalesDocumentKind.quotation => 'quotation',
      SalesDocumentKind.order => 'order',
      SalesDocumentKind.invoice => 'invoice',
    };
  }

  /// Loads the document from the API (including line items), then [download].
  static Future<void> downloadById({
    required AuthController auth,
    required SalesDocumentKind kind,
    required int id,
  }) async {
    if (id <= 0) return;
    final res = await auth.authorizedRequest(method: 'GET', path: _detailPath(kind, id));
    final root = res as Map;
    final raw = root[_responseKey(kind)];
    if (raw is! Map) {
      throw StateError('Invalid document response');
    }
    final doc = Map<String, dynamic>.from(raw);
    await download(auth: auth, doc: doc, kind: kind);
  }

  /// Fetches company settings, builds a PDF, then opens the share sheet (mobile/desktop)
  /// or browser download (web).
  static Future<void> download({
    required AuthController auth,
    required Map<String, dynamic> doc,
    required SalesDocumentKind kind,
  }) async {
    final raw = await auth.authorizedRequest(method: 'GET', path: '/settings/company');
    final company = Map<String, dynamic>.from(raw as Map);
    final bytes = await SalesDocumentPdfBuilder.build(doc: doc, company: company, kind: kind);
    final name = SalesDocumentPdfBuilder.suggestedFileName(doc: doc, kind: kind);
    await savePdfDownload(fileName: name, bytes: bytes);
  }
}
