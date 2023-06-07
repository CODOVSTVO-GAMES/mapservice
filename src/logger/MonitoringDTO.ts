export class MonitoringDTO {
    service: string;
    requestName: string;
    status: number;
    msg: string;
    data: string;
    time: number

    constructor(service: string, requestName: string, status: number, msg: string, data: string, time: number) {
        this.service = service
        this.requestName = requestName
        this.status = status
        this.msg = msg
        this.data = data
        this.time = time
    }
  }
  