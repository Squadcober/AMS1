export interface AttendanceRecord {
  academyId: string;
  date: string;
  type: 'player' | 'coach';
  records: {
    [id: string]: {
      status: 'present' | 'absent' | 'unmarked';
      markedBy: string;
      markedAt: string;
      notes?: string;
    }
  };
}
