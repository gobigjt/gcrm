import '../auth/auth_controller.dart';
import 'package:http/http.dart' as http;
import '../../core/storage/save_pdf.dart';
import '../../core/utils/media_url.dart';
import 'sales_document_kind.dart';

bool _isGeneratedPdfPath(String url) {
  final u = url.trim();
  return u.contains('/sales/generated-pdfs/');
}

class SalesDocumentPdfService {
  SalesDocumentPdfService._();

  static String _pdfPath(SalesDocumentKind kind, int id) {
    return switch (kind) {
      SalesDocumentKind.quotation => '/sales/quotations/$id/pdf',
      SalesDocumentKind.order => '/sales/orders/$id/pdf',
      SalesDocumentKind.invoice => '/sales/invoices/$id/pdf',
    };
  }

  static String _defaultFileName(SalesDocumentKind kind, int id) {
    return switch (kind) {
      SalesDocumentKind.quotation => 'quotation-$id.pdf',
      SalesDocumentKind.order => 'order-$id.pdf',
      SalesDocumentKind.invoice => 'invoice-$id.pdf',
    };
  }

  /// Loads the document from the API (including line items), then [download].
  static Future<void> downloadById({
    required AuthController auth,
    required SalesDocumentKind kind,
    required int id,
  }) async {
    if (id <= 0) return;
    final res = await auth.authorizedRequest(method: 'GET', path: _pdfPath(kind, id));
    final root = Map<String, dynamic>.from(res as Map);
    final relUrl = (root['url'] ?? '').toString().trim();
    if (relUrl.isEmpty) {
      throw StateError('PDF url missing from API response');
    }
    final fileName = (root['file_name'] ?? '').toString().trim();
    final name = fileName.isEmpty ? _defaultFileName(kind, id) : fileName;

    late final List<int> bytes;
    if (_isGeneratedPdfPath(relUrl)) {
      var path = relUrl.trim();
      if (path.startsWith('/api/')) {
        path = path.substring('/api'.length);
      }
      if (!path.startsWith('/')) path = '/$path';
      bytes = await auth.authorizedGetBytes(path: path);
    } else {
      final publicUrl = resolveUploadsPublicUrl(relUrl);
      if (publicUrl.isEmpty) {
        throw StateError('Invalid public PDF url');
      }
      final fileRes = await http.get(Uri.parse(publicUrl));
      if (fileRes.statusCode < 200 || fileRes.statusCode >= 300) {
        throw StateError('Failed to download generated PDF');
      }
      bytes = fileRes.bodyBytes;
    }
    await savePdfDownload(fileName: name, bytes: bytes);
  }

  /// Uses backend PDF generator endpoint and downloads returned file URL.
  static Future<void> download({
    required AuthController auth,
    required Map<String, dynamic> doc,
    required SalesDocumentKind kind,
  }) async {
    final id = (doc['id'] as num?)?.toInt() ?? 0;
    if (id <= 0) throw StateError('Invalid document id for PDF');
    await downloadById(auth: auth, kind: kind, id: id);
  }
}
