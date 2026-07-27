export type CreateRouteDTO = {
    trainId: string;
    stops: {
        stationId: string;
        sequence: number;
        arrivalDay?: number | null;
        departureDay?: number | null;
        arrivalMinute?: number | null;
        departureMinute?: number | null;
        haltMinutes?: number | null;
    }[];
}

