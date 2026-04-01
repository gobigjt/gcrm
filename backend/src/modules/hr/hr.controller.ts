import { BadRequestException, Body, Controller, Get, NotFoundException, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard }   from '../../common/guards/roles.guard';
import { Roles }        from '../../common/decorators/roles.decorator';
import { HrService }    from './hr.service';

@ApiTags('HR')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('Admin','HR','Manager')
@Controller('hr')
export class HrController {
  constructor(private readonly svc: HrService) {}

  @Get('employees')       listEmployees()     { return this.svc.listEmployees(); }
  @Post('employees')      createEmployee(@Body() b: any) { return this.svc.createEmployee(b); }
  @Get('employees/:id')   async getEmployee(@Param('id') id: string) { const e=await this.svc.getEmployee(Number(id)); if(!e) throw new NotFoundException(); return {employee:e}; }
  @Patch('employees/:id') updateEmployee(@Param('id') id: string, @Body() b: any) { return this.svc.updateEmployee(Number(id), b); }
  @Get('employees/:id/attendance') getAttendance(@Param('id') id: string, @Query('from') from?: string, @Query('to') to?: string) {
    return this.svc.getAttendance(Number(id), from, to);
  }

  @Post('attendance')         markAttendance(@Body() b: any) { return this.svc.markAttendance(b); }
  @Get('attendance/summary')  getAttendanceSummary(@Query('from') from: string, @Query('to') to: string) {
    if(!from||!to) throw new BadRequestException('from and to required');
    return this.svc.getAttendanceSummary(from, to);
  }

  @Get('payroll')          listPayroll(@Query('month') m: string, @Query('year') y: string) {
    if(!m||!y) throw new BadRequestException('month and year required');
    return this.svc.listPayroll(Number(m), Number(y));
  }
  @Post('payroll')         createPayroll(@Body() b: any) { return this.svc.createPayroll(b); }
  @Patch('payroll/:id/process') processPayroll(@Param('id') id: string) { return this.svc.processPayroll(Number(id)); }
  @Patch('payroll/:id/pay')     payPayroll(@Param('id') id: string)     { return this.svc.payPayroll(Number(id)); }
}
