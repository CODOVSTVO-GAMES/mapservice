import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { MonitoringDTO } from './MonitoringDTO';

@Injectable()
export class LoggerService {
    @Inject('monitoring-module') private readonly monitoringClient: ClientProxy

    sendLog(service: string, requestName: string, status: number, msg: string, data: string, time = 0) {
        const monitoringDTO = new MonitoringDTO(service, requestName, status, msg, data, time)
        this.questionerMonitoring(monitoringDTO)
    }

    private async questionerMonitoring(data: object) {
        try {
            await this.monitoringClient.emit('send_log', data).toPromise()
        } catch (e) {
            if (e.message == 'Timeout has occurred') {
                throw "timeout"
            }
            else if (e.err.code == 'ECONNREFUSED') {
                this.monitoringClient.close()
                throw "ECONNREFUSED"
            } else {
                console.log("Ошибка не обрабатывается")
                console.log(e)
                throw "unkown"
            }
        }
    }
}
