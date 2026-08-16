import { ConfigService } from '@nestjs/config';
import { PdfImportService } from './pdf-import.service';

describe('PdfImportService', () => {
  let service: PdfImportService;

  function makeService(env: Record<string, string> = {}): PdfImportService {
    const config = new ConfigService(env);
    return new PdfImportService(config);
  }

  const pdfFile = (overrides: Partial<Express.Multer.File> = {}) =>
    ({
      buffer: Buffer.from('%PDF-1.4 fake'),
      size: 12,
      originalname: 'statement.pdf',
      mimetype: 'application/pdf',
      ...overrides,
    }) as Express.Multer.File;

  describe('extractPdf', () => {
    it('rejects a missing file', async () => {
      service = makeService();
      await expect(
        service.extractPdf(undefined as never),
      ).rejects.toMatchObject({ response: { code: 'PDF_UPLOAD_REQUIRED' } });
    });

    it('rejects an oversized file before calling the service', async () => {
      service = makeService();
      const file = pdfFile({ size: 21 * 1024 * 1024 });
      await expect(service.extractPdf(file)).rejects.toMatchObject({
        response: { code: 'PDF_TOO_LARGE' },
      });
    });

    it('returns extraction results from the PDF service', async () => {
      service = makeService({ PDF_SERVICE_URL: 'http://pdf.local' });
      const payload = {
        headers: ['Date', 'Description', 'Amount'],
        rows: [['01/05/2024', 'Coffee', '-5.50']],
        hasHeader: true,
        pageCount: 1,
        filename: 'statement.pdf',
      };
      const fetchMock = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(payload),
      });
      global.fetch = fetchMock;

      const result = await service.extractPdf(pdfFile());

      expect(result).toEqual(payload);
      expect(fetchMock).toHaveBeenCalledWith(
        'http://pdf.local/extract',
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('uses the default service URL when unset', async () => {
      service = makeService();
      const fetchMock = jest.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            headers: [],
            rows: [],
            hasHeader: false,
            pageCount: 1,
            filename: 'a.pdf',
          }),
      });
      global.fetch = fetchMock;

      await service.extractPdf(pdfFile());
      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:8000/extract',
        expect.anything(),
      );
    });

    it('maps a connection failure to PDF_SERVICE_UNAVAILABLE', async () => {
      service = makeService();
      global.fetch = jest.fn().mockRejectedValue(new Error('ECONNREFUSED'));

      await expect(service.extractPdf(pdfFile())).rejects.toMatchObject({
        response: { code: 'PDF_SERVICE_UNAVAILABLE' },
      });
    });

    it('maps a Python error response to PDF_EXTRACTION_FAILED', async () => {
      service = makeService();
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 422,
        json: () => Promise.resolve({ detail: 'No tabular data found.' }),
      });

      let caught: { response?: { message?: string } } | undefined;
      try {
        await service.extractPdf(pdfFile());
      } catch (error) {
        caught = error as { response?: { message?: string } };
      }
      expect(caught?.response?.code).toBe('PDF_EXTRACTION_FAILED');
      expect(caught?.response?.message).toContain('No tabular data');
    });

    it('propagates 413 from the PDF service as PDF_TOO_LARGE', async () => {
      service = makeService();
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 413,
        json: () => Promise.resolve({ detail: 'File is larger than 20 MB.' }),
      });

      await expect(service.extractPdf(pdfFile())).rejects.toMatchObject({
        response: { code: 'PDF_TOO_LARGE' },
      });
    });
  });

  describe('toCsv', () => {
    it('serializes headers and rows into a CSV string', () => {
      service = makeService();
      const result = service.toCsv({
        headers: ['Date', 'Description', 'Amount'],
        rows: [
          ['01/05/2024', 'Coffee', '-5.50'],
          ['01/06/2024', 'Paycheck, salary', '+3000.00'],
        ],
        hasHeader: true,
        pageCount: 1,
        filename: 'statement.pdf',
      });

      expect(result.csv).toContain('Date,Description,Amount');
      expect(result.csv).toContain('01/05/2024,Coffee,-5.50');
      expect(result.csv).toContain('"Paycheck, salary"');
      expect(result.filename).toBe('statement.pdf');
      expect(result.pageCount).toBe(1);
    });

    it('omits the header when the extraction found none', () => {
      service = makeService();
      const result = service.toCsv({
        headers: [],
        rows: [['01/05/2024', 'Coffee', '-5.50']],
        hasHeader: false,
        pageCount: 1,
        filename: 'statement.pdf',
      });

      expect(result.csv).not.toContain('Date');
      expect(result.csv).toContain('01/05/2024');
    });
  });
});
