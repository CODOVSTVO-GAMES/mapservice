import { Injectable } from '@nestjs/common';
import { ResponseDTO } from './DTO/ResponseDTO';
import { DataDTO } from './DTO/DataDTO';
import { InjectRepository } from '@nestjs/typeorm';
import { Building } from './Models/Bullding';
import { Repository } from 'typeorm';


@Injectable()
export class AppService {

    constructor(
        @InjectRepository(Building) private mapRepo: Repository<Building>
    ) { }

    // async dataSaveResponser(data: any) {
    //     const responseDTO = new ResponseDTO()
    //     let status = 200

    //     try {
    //         const resonseDataDTO = await this.dataSaveHandler(data)
    //         responseDTO.data = resonseDataDTO
    //     }
    //     catch (e) {
    //         if (e == 'sessions not found' || e == 'session expired') {
    //             status = 403//перезапуск клиента
    //         }
    //         else if (e == 'too many requests') {
    //             status = 429//повторить запрос позже
    //         } else if (e == 'parsing data error') {
    //             status = 400 //сервер не знает что делать
    //         } else {
    //             status = 400
    //         }
    //         console.log("Ошибка " + e)
    //     }
    //     responseDTO.status = status

    //     return responseDTO
    // }

    // async dataSaveHandler(data: any): Promise<ResonseDataDTO> {
    //     let dataDTO
    //     try {
    //         dataDTO = new DataDTO(data.accountId, data.sessionId, data.dataObjects)
    //     } catch (e) {
    //         throw "parsing data error"
    //     }

    //     return this.dataSaveLogic(dataDTO)
    // }


    // async dataSaveLogic(dataDTO: DataDTO): Promise<ResonseDataDTO> {
    //     const accountId = dataDTO.accountId
    //     const incomingObjects = this.parseDataObjectsPOST(dataDTO.dataObjects)

    //     const savedObjects = await this.findAllDataObjectsByAccountId(accountId)

    //     for (let l = 0; l < incomingObjects.length; l++) {
    //         try {
    //             const obj = this.getObjectByKey(incomingObjects[l].key, savedObjects)
    //             await this.updateObjectsValueByAccountIdAndKey(obj, incomingObjects[l].value)
    //             console.log("Обновлен обьект: " + incomingObjects[l].key)
    //         } catch (e) {
    //             if (e == 'object not found') {
    //                 await this.saveObject(accountId, incomingObjects[l].key, incomingObjects[l].value)
    //                 console.log("Сохранен новый обьект: " + incomingObjects[l].key)
    //                 continue
    //             }
    //             console.log("Хз чего произошло")
    //             throw e
    //         }
    //     }
    //     return new ResonseDataDTO()
    // }

    //----------------------------------------

    async dataGetResponser(data: any) {
        const responseDTO = new ResponseDTO()
        let status = 200

        try {
            const resonseDataDTO = await this.dataGetHandler(data)
            responseDTO.data = {}
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

    async dataGetHandler(data: any) {
        let dataDTO
        try {
            dataDTO = new DataDTO(data.accountId, data.zoneId)
        } catch (e) {
            throw "parsing data error"
        }

        return this.dataGetLogic(dataDTO)
    }

    async dataGetLogic(dataDTO: DataDTO) {
        // let bace = 

        //получить айди зоны и айди пользователя
        //пройтись по всем обьектам, узнать есть ли такой юзер
        //если нет создать нового
        //если есть вернуть его чанк



        // const accountId = dataDTO.accountId
        // const incomingObjects = this.parseDataObjectsGET(dataDTO.dataObjects)

        // const savedObjects = await this.findAllDataObjectsByAccountId(accountId)

        // const responseObjects: DataObjectsDTO[] = []

        // for (let l = 0; l < incomingObjects.length; l++) {
        //     try {
        //         const obj = this.getObjectByKey(incomingObjects[l], savedObjects)
        //         const data = JSON.parse(obj.data)
        //         responseObjects.push(new DataObjectsDTO(obj.className, data))
        //     } catch (e) {
        //         if (e == 'object not found') {
        //             console.log("Запрошен пустой класс!!!")
        //             //log
        //             responseObjects.push(new DataObjectsDTO(incomingObjects[l], {}))
        //         }
        //         else {
        //             throw "ЧТо то тут не так"
        //         }
        //     }
        // }
        // const resonseDataDTO = new ResonseDataDTO()
        // resonseDataDTO.objects = responseObjects
        // return resonseDataDTO
        return 0
    }

    //----------------------------------------------------------

    parseDataObjectsGET(objects: object): Array<string> {
        const dataObjects = []
        const arr: string[] = Object.values(objects)
        for (let l = 0; l < arr.length; l++) {
            dataObjects.push(arr[l])
        }
        return dataObjects
    }

    async findBaseByAccountIdAndZoneId(accountId: string, zoneId: string) {
        const base = await this.mapRepo.find({
            where: {
                accountId: accountId,
                zoneId: zoneId
            }
        })
        return base
    }
}


