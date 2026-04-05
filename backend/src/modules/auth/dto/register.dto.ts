import { IsEmail, IsIn, IsNotEmpty, IsOptional, MinLength } from 'class-validator';
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
    enum: ['Super Admin', 'Admin', 'Sales Executive', 'HR'],
    default: 'Sales Executive',
  })
  @IsOptional()
  @IsIn(['Super Admin', 'Admin', 'Sales Executive', 'HR'])
  role?: string;
}
