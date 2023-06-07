export class DataDTO {
    accountId: string
    zoneId: string
    chunk: string
    constructor(accountId: string, zoneId: string, chunk: string) {
        this.accountId = accountId
        this.zoneId = zoneId
        this.chunk = chunk
    }
}
