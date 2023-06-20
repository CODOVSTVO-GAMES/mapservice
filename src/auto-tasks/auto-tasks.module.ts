import { Module } from '@nestjs/common';
import { AutoTasksService } from './auto-tasks.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Building } from 'src/Models/Building';

@Module({
  providers: [AutoTasksService],
  imports: [TypeOrmModule.forFeature([Building])]
})
export class AutoTasksModule { }
