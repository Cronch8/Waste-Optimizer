
export interface PumpScheduleEntry {
  Datetime: string; // Format: "MM-DD-YYYY HH:MM:SS"
  Pumps: {
    id: number;
    active: boolean;
    inflowRate?: number;
  }[];
}

export const generateMockPumpSchedule = (): PumpScheduleEntry[] => {
  const schedule: PumpScheduleEntry[] = [];
  return schedule;
};

