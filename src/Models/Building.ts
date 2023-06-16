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

    @Column({ nullable: true })
    accountId: string

    @Column({ nullable: true })
    level: number

    @Column({ nullable: true })
    stars: number

    @Column({ type: "bigint" })
    expiration: number
}