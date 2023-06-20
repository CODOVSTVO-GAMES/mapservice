import { Inject, Injectable } from '@nestjs/common';
import { ResponseDTO } from './DTO/ResponseDTO';
import { DataDTO } from './DTO/DataDTO';
import { InjectRepository } from '@nestjs/typeorm';
import { Building } from './Models/Building';
import { Between, Repository } from 'typeorm';
import { LoggerService } from './logger/logger.service';
import { RabbitMQService } from './rabbit/rabbit.servicve';
import { get } from 'http';
import e from 'express';


@Injectable()
export class AppService {

    private mapSizeCells = 512
    private mapSizeChunks = 32

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
            dataDTO = new DataDTO(data.accountId, data.zone, data.x, data.y, data.level, data.battlesNumberr, data.battleOwner)
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
            building.level = dataDTO.level
            await this.mapRepo.save(building)
        }
        catch (e) {
            //возможны неконтролируемые ошибки
            console.log('ошибка:    ' + e)
            building = await this.createBace(dataDTO.accountId, dataDTO.zone, dataDTO.level)
        }

        return building
    }

    async findObjects(coords: Vector2, zone: string): Promise<Building[]> {
        //запросить весь чанк из бд
        //получить координату начала и конца чанка по двум осям

        const arrChunkId = this.getNearestChunksId(coords)
        console.log(JSON.stringify(arrChunkId))

        let buildings: Building[] = []
        for (let l = 0; l < arrChunkId.length; l++) {
            const chunkId = new Vector2(arrChunkId[l].x, arrChunkId[l].y)
            const newBuildings = await this.getChunkBuildings(chunkId, zone)
            buildings = buildings.concat(newBuildings)
            console.log('в чанке ' + newBuildings.length + " " + JSON.stringify(newBuildings))
        }
        console.log('Найдено ' + buildings.length)

        return buildings
    }

    private async getChunkBuildings(chunkId: Vector2, zone: string): Promise<Building[]> {
        const startCoord = this.getChunkStartCoord(chunkId)
        const endCoord = this.getChunkEndCoord(chunkId)

        const buildings = await this.mapRepo.find({
            where: {
                zone: zone,
                x: Between(startCoord.x - 1, endCoord.x - 1),
                y: Between(startCoord.y - 1, endCoord.y - 1)
            }
        })
        return buildings
    }

    private getChunkId(baseCoords: Vector2): Vector2 {
        const xChunk = Math.floor(baseCoords.x / this.getChunkSize())
        const yChunk = Math.floor(baseCoords.y / this.getChunkSize())
        return new Vector2(xChunk, yChunk)
    }

    private getNearestChunksId(coords: Vector2): Vector2[] {
        const chunk = this.getChunkId(coords)
        const arr = []
        arr.push(chunk)
        arr.push(new Vector2(chunk.x - 1, chunk.y))
        arr.push(new Vector2(chunk.x + 1, chunk.y))
        arr.push(new Vector2(chunk.x, chunk.y + 1))
        arr.push(new Vector2(chunk.x, chunk.y - 1))
        arr.push(new Vector2(chunk.x - 1, chunk.y + 1))
        arr.push(new Vector2(chunk.x + 1, chunk.y + 1))
        arr.push(new Vector2(chunk.x - 1, chunk.y - 1))
        arr.push(new Vector2(chunk.x + 1, chunk.y - 1))
        return arr
    }

    private getChunkStartCoord(vector: Vector2): Vector2 {
        const x = vector.x * this.getChunkSize()
        const y = vector.y * this.getChunkSize()
        return new Vector2(x, y)
    }

    private getChunkEndCoord(vector: Vector2): Vector2 {
        const x = vector.x * this.getChunkSize() + this.getChunkSize()
        const y = vector.y * this.getChunkSize() + this.getChunkSize()
        return new Vector2(x, y)
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

    async createBace(accountId: string, zone: string, level = 1): Promise<Building> {
        const freeCoordinates = await this.generateFreeCoordinates()
        return await this.mapRepo.save(
            this.mapRepo.create(
                {
                    accountId: accountId,
                    zone: zone,
                    type: 'base',
                    x: freeCoordinates.x,
                    y: freeCoordinates.y,
                    expiration: Date.now() + 2592000000, //30 дней
                    level: level
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
            dataDTO = new DataDTO(data.accountId, data.zone, data.x, data.y, data.level, data.battlesNumber, data.battleOwner)
            if (Number.isNaN(dataDTO.x) || Number.isNaN(dataDTO.y) || dataDTO.level == undefined) {
                throw 'Пришли пустые данные'
            }
        } catch (e) {
            throw "parsing data error"
        }

        return await this.generateEnemyLogic(dataDTO)
    }

    async generateEnemyLogic(dataDTO: DataDTO): Promise<Building[]> {
        console.log(dataDTO)
        /**
         * у игрока есть адрес базы и айди зоны
         * В базе данных лежат обьекты карты
         * 
         * запрашиваем обьекты вокруг игрока
         * проверяем сколько вокруг противников нужного уровня
         * если больше чем надо просто возвращаем структуру
         * если меньше то доспавниваем нужное число
         */

        console.log('1')
        const baseCoords = new Vector2(dataDTO.x, dataDTO.y)
        const buildings = await this.findObjects(baseCoords, dataDTO.zone)

        let battleFits = 0
        console.log('2 ' + buildings.length)

        for (let l = 0; l < buildings.length; l++) {
            if ((buildings[l].type == 'taskSalvation' || buildings[l].type == 'taskPersonal') && buildings[l].level == dataDTO.level) {
                battleFits += 1
                if (battleFits >= dataDTO.battlesNumber) {
                    console.log('22 ' + buildings.length)
                    return buildings
                }
            }
        }
        console.log('3')

        const createBattlesNumber = dataDTO.battlesNumber - battleFits

        console.log('4')

        for (let l = 0; l < createBattlesNumber; l++) {
            const baseCoords = new Vector2(dataDTO.x, dataDTO.y)
            const enemy = await this.createNewEnemy(baseCoords, dataDTO.level, dataDTO.zone)
            buildings.push(enemy)
        }
        console.log('5 ' + buildings.length)
        return buildings
    }

    private async createNewEnemy(baseCoords: Vector2, level: number, zone: string): Promise<Building> {
        const type = this.createEnemyType()
        const stars = this.createEnemyStars()
        const coords = await this.generateFreeCoordinatesBetveen(baseCoords.x, baseCoords.y)
        return await this.createEnemy(type, level, stars, zone, coords)
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


    //--------------------
    async attackEnemyResponser(data: any): Promise<ResponseDTO> {
        const responseDTO = new ResponseDTO()
        let status = 200

        try {
            const response = await this.attackEnemyHandler(data)
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

    async attackEnemyHandler(data: any): Promise<Building> {
        let dataDTO
        try {
            dataDTO = new DataDTO(data.accountId, data.zone, data.x, data.y, data.level, data.battlesNumber, data.battleOwner)
            if (Number.isNaN(dataDTO.x) || Number.isNaN(dataDTO.y)) {
                throw 'Пришли пустые данные'
            }
        } catch (e) {
            throw "parsing data error"
        }

        return await this.attackEnemyLogic(dataDTO)
    }

    async attackEnemyLogic(dataDTO: DataDTO): Promise<Building> {
        //запрос на атаку базы в координатах
        //если никто не атакует записываем айди атакующео
        //если кто то атакует - спавним рядом, ставим айди атакующего
        //возвращаем обьект который атакуем

        let enemy = (await this.getEnemy(dataDTO))

        if (enemy.battleOwner != 'empty') {
            const baseCoords = new Vector2(dataDTO.x, dataDTO.y)
            enemy = await this.createNewEnemy(baseCoords, dataDTO.level, dataDTO.zone)
        }
        enemy.battleOwner = dataDTO.accountId
        this.mapRepo.save(enemy)

        return enemy
    }


    async getEnemy(dataDTO: DataDTO): Promise<Building> {
        let enemy: Building
        try {
            enemy = await this.getEnemyById(dataDTO.enemyId)
        }
        catch (e) {
            console.log('врага нет? cоздаем нового' + e)
            const baseCoords = new Vector2(dataDTO.x, dataDTO.y)
            enemy = await this.createNewEnemy(baseCoords, dataDTO.level, dataDTO.zone)
        }
        return enemy
    }

    async getEnemyById(id: number): Promise<Building> {
        const buildings = await this.mapRepo.find({
            where: {
                id: id
            }
        })
        if (buildings.length == 0) throw 'Базы не существует'
        return buildings[0]
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

