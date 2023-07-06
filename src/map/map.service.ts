import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { BuildingTypes } from 'src/BuildingTypes';
import { DataDTO } from 'src/DTO/DataDTO';
import { Building } from 'src/Models/Building';
import { Between, Repository } from 'typeorm';

@Injectable()
export class MapService {
    public MAPSIZESELLS = 512
    public MAPSIZECHUNKS = 32

    constructor(
        @InjectRepository(Building) private mapRepo: Repository<Building>
    ) { }

    public getChunkSize(): number {
        return this.MAPSIZESELLS / this.MAPSIZECHUNKS
    }

    public getChunkStartCoord(vector: Vector2): Vector2 {
        const x = vector.x * this.getChunkSize()
        const y = vector.y * this.getChunkSize()
        return new Vector2(x, y)
    }

    public getChunkEndCoord(vector: Vector2): Vector2 {
        const x = vector.x * this.getChunkSize() + this.getChunkSize()
        const y = vector.y * this.getChunkSize() + this.getChunkSize()
        return new Vector2(x, y)
    }

    private getChunkId(baseCoords: Vector2): Vector2 {
        const xChunk = Math.floor(baseCoords.x / this.getChunkSize())
        const yChunk = Math.floor(baseCoords.y / this.getChunkSize())
        return new Vector2(xChunk, yChunk)
    }

    public getNearestChunksId(coords: Vector2): Vector2[] {
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

        const noNullArr = []
        for (let l = 0; l < arr.length; l++) {
            if (arr[l].x >= 0 && arr[l].y >= 0) {
                noNullArr.push(arr[l])
            }
        }

        return noNullArr
    }

    public async createNewEnemy(dataDTO: DataDTO): Promise<Building> {
        const type = this.createEnemyType()
        const stars = this.createEnemyStars()
        const coords = await this.generateFreeCoordinatesBetveen(dataDTO.x, dataDTO.y)
        return await this.createEnemy(type, dataDTO.level, stars, dataDTO.zone, coords, dataDTO.accountId)
    }


    private getRandomBattleTime() {
        const minTime = 10
        const maxTime = 30
        return Math.floor(Math.random() * (maxTime - minTime) + minTime)

    }

    public generateNumberBetven(x: number): number {
        const offset = 20
        const xStart = x - offset
        const xEnd = x + offset
        return Math.floor(Math.random() * (xEnd - xStart)) + xStart
    }


    public async generateFreeCoordinatesBetveen(xBase: number, yBase: number): Promise<Vector2> {
        const x = this.generateNumberBetven(xBase)
        const y = this.generateNumberBetven(yBase)
        if (await this.isCoordinatesFree(x, y)) {
            return new Vector2(x, y)
        }
        else {
            return await this.generateFreeCoordinatesBetveen(xBase, yBase)
        }
    }

    private createEnemyType() {
        return BuildingTypes.MISSION_SLAWATION
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

    private createEnemyStars(): number {
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

        const arrChunkId = this.getNearestChunksId(coords)

        let buildings: Building[] = []
        for (let l = 0; l < arrChunkId.length; l++) {
            const chunkId = new Vector2(arrChunkId[l].x, arrChunkId[l].y)
            const newBuildings = await this.getChunkBuildings(chunkId, zone)
            buildings = buildings.concat(newBuildings)
        }

        return this.deleteRecurring(buildings)
    }

    private async getChunkBuildings(chunkId: Vector2, zone: string): Promise<Building[]> {
        const startCoord = this.getChunkStartCoord(chunkId)
        const endCoord = this.getChunkEndCoord(chunkId)

        const buildings = await this.mapRepo.find({
            where: {
                zone: zone,
                x: Between(startCoord.x, endCoord.x),
                y: Between(startCoord.y, endCoord.y)
            }
        })
        return buildings
    }

    deleteRecurring(arr: Building[]): Building[] {
        const indexes: number[] = []
        const newArr: Building[] = []
        for (let l = 0; l < arr.length; l++) {
            if (!this.isBuildingInArray(arr[l], indexes)) {
                indexes.push(arr[l].id)
                newArr.push(arr[l])
            }
        }
        return newArr
    }

    isBuildingInArray(building: Building, indexes: number[]): boolean {
        for (let i = 0; i < indexes.length; i++) {
            if (indexes[i] == building.id) {
                return true
            }
        }
        return false
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
                    type: BuildingTypes.BASE,
                    x: freeCoordinates.x,
                    y: freeCoordinates.y,
                    expiration: Date.now() + 3600000,//2592000000, //30 дней
                    level: level,
                    isBattle: false
                }
            )
        )
    }

    async createEnemy(type: string, level: number, stars: number, zone: string, coords: Vector2, owner: string): Promise<Building> {
        return await this.mapRepo.save(
            this.mapRepo.create(
                {
                    zone: zone,
                    type: type,
                    level: level,
                    stars: stars,
                    x: coords.x,
                    y: coords.y,
                    expiration: Date.now() + 1200000,//20 минут
                    owner: owner,
                    battleTime: this.getRandomBattleTime(),
                    isBattle: false
                }
            )
        )
    }

    async createMine(coords: Vector2): Promise<Building> {
        const freeCord = await this.generateFreeCoordinatesByChunk(coords)
        return await this.mapRepo.save(
            this.mapRepo.create(
                {
                    zone: 'testzone-',
                    type: BuildingTypes.MINE,
                    level: 1,
                    x: freeCord.x,
                    y: freeCord.y,
                    owner: 'empty',
                    isBattle: false,
                    expiration: Date.now() + 12000000,//20 минут
                }
            )
        )
    }

    private generateRandomCoordinate() {
        return Math.floor(Math.random() * this.MAPSIZESELLS / this.MAPSIZECHUNKS * 2)
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

    private generateRandomCoordinateByChunk(chunk: Vector2): Vector2 {
        const startCoord = this.getChunkStartCoord(chunk)
        const endCoord = this.getChunkEndCoord(chunk)

        const xCoord = Math.floor(Math.random() * (endCoord.x - startCoord.x) + startCoord.x)
        const yCoord = Math.floor(Math.random() * (endCoord.y - startCoord.y) + startCoord.y)

        return new Vector2(xCoord, yCoord)
    }

    async generateFreeCoordinatesByChunk(chunk: Vector2): Promise<Vector2> {
        const coord = this.generateRandomCoordinateByChunk(chunk)
        if (await this.isCoordinatesFree(coord.x, coord.y)) {
            return coord
        }
        else {
            return await this.generateFreeCoordinatesByChunk(chunk)
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

    public getAllChunks() {
        //двумя циклами добавить в массив все координаты
        const arr = []
        for (let l = 0; l < this.MAPSIZECHUNKS; l++) {
            for (let i = 0; i < this.MAPSIZECHUNKS; i++) {
                arr.push(new Vector2(l, i))
            }
        }
        return arr
    }
}

export class Vector2 {
    x: number
    y: number
    constructor(x: number, y: number) {
        this.x = x
        this.y = y
    }
}

