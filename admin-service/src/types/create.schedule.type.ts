import { ScheduleStatus } from "@prisma/client"

export type CreateScheduleDTO = {
    trainId: string,
    departureDate: Date,
    status: ScheduleStatus
}
