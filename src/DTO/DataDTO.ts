export class DataDTO {
    accountId: string
    zone: string
    x: number
    y: number
    level: number
    battlesNumber: number
    

    constructor(accountId: string, zone: string, x: number, y: number, level: number, battlesNumber: number) {
        this.accountId = accountId
        this.zone = zone
        this.x = x
        this.y = y
        this.level = level
        this.battlesNumber = battlesNumber
    }
}
