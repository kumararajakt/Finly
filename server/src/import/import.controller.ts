import { Body, Controller, Post } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { CsvImportDto, CsvPreviewDto } from './import.dto';
import type {
  CsvImportPreview,
  CsvImportResult,
  CsvPreviewResult,
} from './import.service';
import { ImportService } from './import.service';

@Controller('import/csv')
export class ImportController {
  constructor(private readonly importService: ImportService) {}

  @Post('preview')
  preview(@Body() body: CsvPreviewDto): CsvPreviewResult {
    return this.importService.preview(body);
  }

  @Post('preview-rows')
  previewRows(
    @CurrentUser() userId: string,
    @Body() body: CsvImportDto,
  ): Promise<CsvImportPreview> {
    return this.importService.previewRows(userId, body);
  }

  @Post()
  importCsv(
    @CurrentUser() userId: string,
    @Body() body: CsvImportDto,
  ): Promise<CsvImportResult> {
    return this.importService.importCsv(userId, body);
  }
}
