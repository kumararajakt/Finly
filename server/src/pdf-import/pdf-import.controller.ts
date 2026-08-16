import {
  BadRequestException,
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { PdfImportService } from './pdf-import.service';
import type { PdfToCsvResult } from './pdf-import.service';

@Controller('import/pdf')
export class PdfImportController {
  constructor(private readonly pdfImportService: PdfImportService) {}

  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 20 * 1024 * 1024 },
    }),
  )
  async extract(
    @UploadedFile() file: Express.Multer.File | undefined,
  ): Promise<PdfToCsvResult> {
    if (!file) {
      throw new BadRequestException({
        message: 'A PDF file is required.',
        code: 'PDF_UPLOAD_REQUIRED',
      });
    }
    const extracted = await this.pdfImportService.extractPdf(file);
    return this.pdfImportService.toCsv(extracted);
  }
}
