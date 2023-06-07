/* eslint-disable @typescript-eslint/no-unused-vars */
import { Injectable, Inject, Global } from '@nestjs/common';
import { timeout } from 'rxjs';
import { ClientProxy } from '@nestjs/microservices/client/client-proxy';

@Global()
@Injectable()
export class RabbitMQService {

    constructor(
        @Inject('user-module') private readonly userClient: ClientProxy,
    ) { }

    async questionerUser(data: object, queue: string) {
        try {
            await this.userClient.send(queue, data).pipe().toPromise()
        } catch (e) {
            console.log(this.errorHandler(e, this.userClient))
        }
    }

    private errorHandler(error: any, client: ClientProxy): string {
        if (error.message == 'Timeout has occurred') {
            return "timeout"
        }
        else if (error.err.code == 'ECONNREFUSED') {
            client.close()
            return "ECONNREFUSED"
        } else {
            console.log("Ошибка не обрабатывается")
            console.log(error)
            return "unkown"
        }
    }
}
