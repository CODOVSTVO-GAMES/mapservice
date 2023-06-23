export class DataDTO {
    accountId: string
    zone: string
    x: number
    y: number
    level: number
    battleOwner: string
    taskId: number
    taskStatus: number

    constructor(accountId: string, zone: string, x: number, y: number, level: number battleOwner: string, taskId: number, taskStatus = 0) {
        this.accountId = accountId
        this.zone = zone
        this.x = x
        this.y = y
        this.level = level
        this.battleOwner = battleOwner
        this.taskId = taskId
        this.taskStatus = taskStatus
    }
}
