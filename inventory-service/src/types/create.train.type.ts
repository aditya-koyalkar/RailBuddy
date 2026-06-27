import { SeatType } from "@prisma/client";

export type CreateTrainDTO = {
    trainNumber: string,
    trainName: string,
    coachName: string,
    totalSeats: number,
    seats: {
        seatNumber: number,
        seatType: SeatType,
        price: number
    }[]
}
