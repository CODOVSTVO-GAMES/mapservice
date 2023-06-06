import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { MicroserviceOptions, Transport } from '@nestjs/microservices'

async function bootstrap() {
    const app = await NestFactory.create(AppModule);
    
    app.connectMicroservice<MicroserviceOptions>({
        transport: Transport.RMQ,
        options: {
            urls: ['amqp://test:test@rabbit:5672'],
            queue: 'to_map_service',
        },
    });

    app.startAllMicroservices()
    await app.listen(3000);
}
bootstrap();
