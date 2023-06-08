import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class Building {
    @PrimaryGeneratedColumn({ type: "bigint" })
    id: number;

    @Column()
    zone: string

    @Column({ type: "smallint" })
    x: number

    @Column({ type: "smallint" })
    y: number

    @Column()
    type: string

    @Column()
    accountId: string
}