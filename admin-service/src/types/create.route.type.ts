export type CreateRouteDTO = {
    trainId: string,
    routeStations: {
        stationId: string,
        arrivalTime: string,
        departureTime: string,
        sequenceNumber: number,
        distanceFromOrigin: number
    }[]
}
