import { CoachType, SeatType } from "@prisma/client";

export type CreateTrainDTO = {
    trainNumber: string;
    name: string;
    coaches: {
        coachNumber: string;
        coachType: CoachType;
        seats: {
            seatNumber: number;
            seatLabel: string;
            seatType: SeatType;
        }[];
    }[];
    fares?: {
        fromStationId: string;
        toStationId: string;
        coachType: CoachType;
        fare: number;
    }[];
}

