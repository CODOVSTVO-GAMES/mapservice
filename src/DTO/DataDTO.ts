export class DataDTO {
    accountId: string
    zone: string
    x: number
    y: number
    level: number
    battlesNumber: number
    battleOwner: string
    enemyId: number
    taskStatus: boolean


    constructor(accountId: string, zone: string, x: number, y: number, level: number, battlesNumber: number, battleOwner: string, enemyId: number, taskStatus = false) {
        this.accountId = accountId
        this.zone = zone
        this.x = x
        this.y = y
        this.level = level
        this.battlesNumber = battlesNumber
        this.battleOwner = battleOwner
        this.enemyId = enemyId
        this.taskStatus = taskStatus
    }
}
