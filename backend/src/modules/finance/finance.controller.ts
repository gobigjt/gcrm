import { BadRequestException, Body, Controller, Get, NotFoundException, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard }  from '../../common/guards/jwt-auth.guard';
import { RolesGuard }    from '../../common/guards/roles.guard';
import { Roles }         from '../../common/decorators/roles.decorator';
import { CurrentUser }   from '../../common/decorators/current-user.decorator';
import { FinanceService} from './finance.service';

@ApiTags('Finance')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('Admin','Accountant')
@Controller('finance')
export class FinanceController {
  constructor(private readonly svc: FinanceService) {}

  @Get('summary')       summary(@CurrentUser() u: any)                     { return this.svc.summary(u); }

  @Get('accounts')      listAccounts(@CurrentUser() u: any)               { return this.svc.listAccounts(u); }
  @Post('accounts')     createAccount(@Body() b: any, @CurrentUser() u: any) { return this.svc.createAccount(b, u); }

  @Get('journals')      listJournals(@Query('from') from?: string, @Query('to') to?: string, @CurrentUser() u?: any) { return this.svc.listJournals(from, to, u); }
  @Post('journals')     createJournal(@Body() b: any, @CurrentUser() u: any) {
    const {lines=[],...data} = b;
    if(lines.length < 2) throw new BadRequestException('At least 2 journal lines required');
    return this.svc.createJournal({...data, created_by: u.id}, lines, u);
  }
  @Get('journals/:id')  async getJournal(@Param('id') id: string, @CurrentUser() u: any) {
    const j = await this.svc.getJournal(Number(id), u);
    if(!j) throw new NotFoundException();
    return { journal: j };
  }

  @Get('expenses')      listExpenses(@Query('from') from?: string, @Query('to') to?: string, @CurrentUser() u?: any) { return this.svc.listExpenses(from, to, u); }
  @Post('expenses')     createExpense(@Body() b: any, @CurrentUser() u: any) { return this.svc.createExpense({...b, created_by: u.id}, u); }

  @Get('reports/pl')   getPLReport(@Query('from') from: string, @Query('to') to: string, @CurrentUser() u: any) {
    if(!from||!to) throw new BadRequestException('from and to required');
    return this.svc.getPLReport(from, to, u);
  }
  @Get('reports/gst')  getGSTReport(@Query('from') from: string, @Query('to') to: string, @CurrentUser() u: any) {
    if(!from||!to) throw new BadRequestException('from and to required');
    return this.svc.getGSTReport(from, to, u);
  }
  @Get('accounts/:id/ledger') getLedger(@Param('id') id: string, @Query('from') from: string, @Query('to') to: string, @CurrentUser() u: any) {
    if(!from||!to) throw new BadRequestException('from and to required');
    return this.svc.getLedger(Number(id), from, to, u);
  }
}
