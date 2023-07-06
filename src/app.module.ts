import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PostgresModule } from './postgres/postgres.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { Building } from './Models/Building';
import { LoggerModule } from './logger/logger.module';
import { RabbitModule } from './rabbit/rabbit.module';
import { AutoTasksModule } from './auto-tasks/auto-tasks.module';
import { MapService } from './map/map.service';
import { MapModule } from './map/map.module';

@Module({
  imports: [PostgresModule, TypeOrmModule.forFeature([Building]), ScheduleModule.forRoot(), LoggerModule, RabbitModule, AutoTasksModule, MapModule],
  controllers: [AppController],
  providers: [AppService, MapService],
})
export class AppModule {
}
