import { Module } from '@nestjs/common';
import { LoggerService } from './logger.service';
import { ClientsModule, Transport } from '@nestjs/microservices';

@Module({
  providers: [LoggerService],
  imports: [
    ClientsModule.register([
      {
        name: 'monitoring-module',
        transport: Transport.RMQ,
        options: {
          urls: ['amqp://test:test@rabbit:5672'],
          queue: 'to_monitoring_service',
        },
      },
    ]),
  ],
  exports: [LoggerService]
})
export class LoggerModule { }
