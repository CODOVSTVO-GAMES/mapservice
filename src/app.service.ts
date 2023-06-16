import { Inject, Injectable } from '@nestjs/common';
import { ResponseDTO } from './DTO/ResponseDTO';
import { DataDTO } from './DTO/DataDTO';
import { InjectRepository } from '@nestjs/typeorm';
import { Building } from './Models/Building';
import { Between, Repository } from 'typeorm';
import { LoggerService } from './logger/logger.service';
import { RabbitMQService } from './rabbit/rabbit.servicve';


@Injectable()
export class AppService {

    private mapSizeCells = 512
    private mapSizeChunks = 8

    constructor(
        @InjectRepository(Building) private mapRepo: Repository<Building>
    ) { }

    @Inject(LoggerService)
    private readonly loggerService: LoggerService

    @Inject(RabbitMQService)
    private readonly rabbitService: RabbitMQService

    async mapGetResponser(data: any): Promise<ResponseDTO> {
        const responseDTO = new ResponseDTO()
        let status = 200

        try {
            const response = await this.mapGetHandler(data)
            responseDTO.data = response
        }
        catch (e) {
            if (e == 'sessions not found' || e == 'session expired') {
                status = 403//перезапуск клиента
            }
            else if (e == 'too many requests') {
                status = 429//повторить запрос позже
            } else if (e == 'parsing data error') {
                status = 400 //сервер не знает что делать
            } else {
                status = 400
            }
            console.log("Ошибка " + e)
        }
        responseDTO.status = status
        return responseDTO
    }

    async mapGetHandler(data: any): Promise<Building[]> {
        let dataDTO
        try {
            dataDTO = new DataDTO(data.accountId, data.zone, data.x, data.y, data.level, data.battlesNumber)
            if (Number.isNaN(dataDTO.x) || Number.isNaN(dataDTO.y)) {
                throw 'Пришли пустые данные'
            }
        } catch (e) {
            throw "parsing data error"
        }

        return await this.mapGetLogic(dataDTO)
    }

    async mapGetLogic(dataDTO: DataDTO): Promise<Building[]> {
        /**
         * у игрока есть адрес базы и айди зоны
         * В базе данных лежат обьекты карты
         * в редисе хранятся чанки карты
         * В редис данные загружаются раз в минуту автоматически либо при совершении критического действия
         * мы доверяем редису что у него последние данные
         * игрок запрашивает карту, мы выдаем ему ближайшие к его координате чанки
         */
        let base: Building

        const zone = dataDTO.zone
        let coords: Vector2

        if (dataDTO.x == 0 && dataDTO.y == 0) {
            base = await this.getBase(dataDTO)
            coords = new Vector2(base.x, base.y)
        }
        else {
            coords = new Vector2(dataDTO.x, dataDTO.y)
        }
        return await this.findObjects(coords, zone)
    }

    async getBase(dataDTO: DataDTO): Promise<Building> {
        /**
         * ищем аккаунт по айди
         * если не находим создаем базу в рандомных координатах
         * если находим отправляем координаты
         */
        let building: Building
        try {
            building = await this.getBaceByAccountid(dataDTO.accountId)
        }
        catch (e) {
            //возможны неконтролируемые ошибки
            console.log('ошибка:    ' + e)
            building = await this.createBace(dataDTO.accountId, dataDTO.zone)
        }

        return building
    }

    async findObjects(coords: Vector2, zone: string): Promise<Building[]> {
        //запросить весь чанк из бд
        //получить координату начала и конца чанка по двум осям

        const xStart = this.getChunkStartCoord(coords.x) - 1
        const yStart = this.getChunkStartCoord(coords.y) - 1

        const xEnd = this.getChunkEndCoord(coords.x) - 1
        const yEnd = this.getChunkEndCoord(coords.y) - 1

        const buildings = await this.mapRepo.find({
            where: {
                zone: zone,
                x: Between(xStart, xEnd),
                y: Between(yStart, yEnd)
            }
        })
        return buildings
    }

    private getChunkStartCoord(coord: number): number {
        return coord - coord % this.getChunkSize()
    }

    private getChunkEndCoord(coord: number): number {
        return coord - coord % this.getChunkSize() + this.getChunkSize()
    }

    private getChunkSize(): number {
        return this.mapSizeCells / this.mapSizeChunks
    }

    async getBaceByAccountid(accountId: string): Promise<Building> {
        const buildings = await this.mapRepo.find({
            where: {
                accountId: accountId
            }
        })
        if (buildings.length == 0) throw 'Базы не существует'
        return buildings[0]
    }

    async createBace(accountId: string, zone: string): Promise<Building> {
        const freeCoordinates = await this.generateFreeCoordinates()
        return await this.mapRepo.save(
            this.mapRepo.create(
                {
                    accountId: accountId,
                    zone: zone,
                    type: 'base',
                    x: freeCoordinates.x,
                    y: freeCoordinates.y,
                    expiration: Date.now() + 2592000000 //30 дней
                }
            )
        )
    }

    private generateRandomCoordinate() {
        return Math.floor(Math.random() * this.mapSizeCells / this.mapSizeChunks * 2)
    }

    private async generateFreeCoordinates(): Promise<Vector2> {
        const x = this.generateRandomCoordinate()
        const y = this.generateRandomCoordinate()
        if (await this.isCoordinatesFree(x, y)) {
            return new Vector2(x, y)
        }
        else {
            return await this.generateFreeCoordinates()
        }
    }

    private async isCoordinatesFree(x: number, y: number): Promise<boolean> {
        const result = await this.mapRepo.find({
            where: {
                x: x,
                y: y
            }
        })
        if (result[0]) {
            return false
        } else {
            return true
        }
    }

    //-----------------------------------------------------------------------

    async generateEnemyResponser(data: any): Promise<ResponseDTO> {
        const responseDTO = new ResponseDTO()
        let status = 200

        try {
            const response = await this.generateEnemyHandler(data)
            responseDTO.data = response
        }
        catch (e) {
            if (e == 'sessions not found' || e == 'session expired') {
                status = 403//перезапуск клиента
            }
            else if (e == 'too many requests') {
                status = 429//повторить запрос позже
            } else if (e == 'parsing data error') {
                status = 400 //сервер не знает что делать
            } else {
                status = 400
            }
            console.log("Ошибка " + e)
        }
        responseDTO.status = status
        return responseDTO
    }


    async generateEnemyHandler(data: any): Promise<Building[]> {
        let dataDTO
        try {
            dataDTO = new DataDTO(data.accountId, data.zone, data.x, data.y, data.level, data.battlesNumber)
            if (Number.isNaN(dataDTO.x) || Number.isNaN(dataDTO.y) || dataDTO.level == undefined) {
                throw 'Пришли пустые данные'
            }
        } catch (e) {
            throw "parsing data error"
        }

        return await this.generateEnemyLogic(dataDTO)
    }

    async generateEnemyLogic(dataDTO: DataDTO): Promise<Building[]> {
        /**
         * у игрока есть адрес базы и айди зоны
         * В базе данных лежат обьекты карты
         * 
         * запрашиваем обьекты вокруг игрока
         * проверяем сколько вокруг противников нужного уровня
         * если больше чем надо просто возвращаем структуру
         * если меньше то доспавниваем нужное число
         */

        console.log("---")
        console.log(dataDTO)
        const baseCoords = new Vector2(dataDTO.x, dataDTO.y)
        const buildings = await this.findObjects(baseCoords, dataDTO.zone)

        let battleFits = 0


        for (let l = 0; l < buildings.length; l++) {
            console.log('1')
            if ((buildings[l].type == 'taskSalvation' || buildings[l].type == 'taskPersonal') && buildings[l].level == dataDTO.level) {
                battleFits += 1
                console.log('повторка')
                if (battleFits >= dataDTO.battlesNumber) {
                    console.log('2')
                    return buildings
                }
            }
        }

        const createBattlesNumber = dataDTO.battlesNumber - battleFits

        for (let l = 0; l < createBattlesNumber; l++) {
            const type = this.createEnemyType()
            const stars = this.createEnemyStars()
            const coords = await this.generateFreeCoordinatesBetveen(dataDTO.x, dataDTO.y)
            console.log('d')
            buildings.push(await this.createEnemy(type, dataDTO.level, stars, dataDTO.zone, coords))
        }
        console.log('3')
        return buildings
    }

    private generateNumberBetven(x: number): number {
        const offset = 20
        const xStart = x - offset
        const xEnd = x + offset
        return Math.floor(Math.random() * (xEnd - xStart)) + xStart
    }


    private async generateFreeCoordinatesBetveen(xBase: number, yBase: number): Promise<Vector2> {
        const x = this.generateNumberBetven(xBase)
        const y = this.generateNumberBetven(yBase)
        if (await this.isCoordinatesFree(x, y)) {
            return new Vector2(x, y)
        }
        else {
            return await this.generateFreeCoordinatesBetveen(xBase, yBase)
        }
    }

    createEnemyType() {
        const random = Math.floor(Math.random() * 100);
        if (random < 60) {
            return 'taskSalvation'
        }
        // else if (random < 95) {
        //     return TypesRadar.TASK_DARK_LEGION; // этих заданий ещё не существует
        // }
        else {
            return 'taskPersonal'
        }
    }

    createEnemyStars(): number {
        const random = Math.floor(Math.random() * 100);
        if (random < 50) {
            return 1;
        }
        else if (random < 75) {
            return 2;
        }
        else if (random < 95) {
            return 3;
        }
        else {
            return 4;
        }
    }

    async createEnemy(type: string, level: number, stars: number, zone: string, coords: Vector2): Promise<Building> {
        return await this.mapRepo.save(
            this.mapRepo.create(
                {
                    zone: zone,
                    type: type,
                    level: level,
                    stars: stars,
                    x: coords.x,
                    y: coords.y,
                    expiration: Date.now() + 600000//10 минут
                }
            )
        )
    }
}

class Vector2 {
    x: number
    y: number
    constructor(x: number, y: number) {
        this.x = x
        this.y = y
    }
}

