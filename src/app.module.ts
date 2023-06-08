import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PostgresModule } from './postgres/postgres.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { Building } from './Models/Building';
import { LoggerModule } from './logger/logger.module';
import { RabbitModule } from './rabbit/rabbit.module';

@Module({
  imports: [PostgresModule, TypeOrmModule.forFeature([Building]), ScheduleModule.forRoot(), LoggerModule, RabbitModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {
}
