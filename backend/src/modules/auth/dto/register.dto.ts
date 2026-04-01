import { IsEmail, IsIn, IsNotEmpty, IsOptional, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ example: 'John Smith' })
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'john@buildconstruct.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'password123', minLength: 6 })
  @IsNotEmpty()
  @MinLength(6)
  password: string;

  @ApiPropertyOptional({ enum: ['Super Admin','Admin','Manager','Agent','Accountant','HR'], default: 'Agent' })
  @IsOptional()
  @IsIn(['Super Admin','Admin','Manager','Agent','Accountant','HR'])
  role?: string;
}
