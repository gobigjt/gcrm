import { IsEmail, IsIn, IsNotEmpty, IsOptional, Matches, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ example: 'John Smith' })
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'john@EzCRM.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'password123', minLength: 6 })
  @IsNotEmpty()
  @MinLength(6)
  password: string;

  @ApiPropertyOptional({
    enum: ['Admin', 'Sales Executive', 'HR'],
    default: 'Sales Executive',
  })
  @IsOptional()
  @IsIn(['Admin', 'Sales Executive', 'HR'])
  role?: string;

  @ApiPropertyOptional({ example: 'igloo-tiles', description: 'Tenant slug for SaaS registration routing' })
  @IsOptional()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'tenant_slug must be lowercase kebab-case',
  })
  tenant_slug?: string;
}
