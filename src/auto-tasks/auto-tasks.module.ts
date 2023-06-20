import { Module } from '@nestjs/common';
import { AutoTasksService } from './auto-tasks.service';

@Module({
  providers: [AutoTasksService]
})
export class AutoTasksModule {}
