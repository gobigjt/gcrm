import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery, ApiProduces } from '@nestjs/swagger';
import { Response } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ExportService } from './export.service';

@ApiTags('Export')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('export')
export class ExportController {
  constructor(private readonly svc: ExportService) {}

  @Get('leads')
  @ApiOperation({ summary: 'Export leads as CSV' })
  @ApiQuery({ name: 'from', required: false, example: '2026-01-01' })
  @ApiQuery({ name: 'to',   required: false, example: '2026-12-31' })
  @ApiProduces('text/csv')
  async leads(@CurrentUser() u: any, @Query('from') from: string, @Query('to') to: string, @Res() res: Response) {
    const csv = await this.svc.leadsCSV(from, to, u);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="leads.csv"');
    res.send(csv);
  }

  @Get('invoices')
  @ApiOperation({ summary: 'Export invoices as CSV' })
  @ApiQuery({ name: 'from', required: false, example: '2026-01-01' })
  @ApiQuery({ name: 'to',   required: false, example: '2026-12-31' })
  @ApiProduces('text/csv')
  async invoices(@CurrentUser() u: any, @Query('from') from: string, @Query('to') to: string, @Res() res: Response) {
    const csv = await this.svc.invoicesCSV(from, to, u);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="invoices.csv"');
    res.send(csv);
  }

  @Get('employees')
  @ApiOperation({ summary: 'Export employees as CSV' })
  @ApiProduces('text/csv')
  async employees(@CurrentUser() u: any, @Res() res: Response) {
    const csv = await this.svc.employeesCSV(u);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="employees.csv"');
    res.send(csv);
  }

  @Get('stock')
  @ApiOperation({ summary: 'Export current stock levels as CSV' })
  @ApiProduces('text/csv')
  async stock(@CurrentUser() u: any, @Res() res: Response) {
    const csv = await this.svc.stockCSV(u);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="stock.csv"');
    res.send(csv);
  }
}
