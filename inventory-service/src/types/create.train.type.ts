export type CreateTrainDTO = {
    trainNumber: string,
    trainName: string,
    coachName: string,
    totalSeats: number,
    seats: {
        seatNumber: number,
        seatType: string,
        price: number
    }[]
}
