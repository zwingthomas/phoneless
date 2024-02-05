export interface GameState {
    isRunning: boolean,
    isWinner: boolean,
    isLoser: boolean,
    display: string,
    sessionId?: string,
    userId?: string
  }

export const GameStates = {
    RUNNING: (sessionId: string, userId: string) => ({ isRunning: true, isWinner: false, isLoser: false, display: 'none', sessionId: sessionId, userId: userId }),
    WON: (sessionId: string, userId: string) => ({ isRunning: false, isWinner: true, isLoser: false, display: 'winner', sessionId: sessionId, userId: userId }),
    LOST: (sessionId: string, userId: string) => ({ isRunning: false, isWinner: false, isLoser: true, display: 'loser', sessionId: sessionId, userId: userId }),
    RESET: () => ({ isRunning: false, isWinner: false, isLoser: false, display: 'none', sessionId: undefined, userId: undefined }),
};

export class EventType {
    static start = new EventType('start');
    static locked = new EventType('locked');
    static unlocked = new EventType('unlocked');
    static powerup = new EventType('powerup');
    private value: string;

    constructor(value: string) {
        this.value = value;
    }

    getValue() {
        return this.value;
    }
}

export type Event = {
    time: number
    eventType: EventType
}

export type FirebaseEvent = {
    time: number;
    eventType: {
      value: string;
    };
}

export interface SessionRow {
    sessionId: string;
    userId: string;
    startTime: number;
    winner?: boolean; // assuming winner is stored and can be undefined if not yet determined
  }
export type Tracker = {
    events: Event[]
}

export function getLastEvent(events: Event[]): Event | undefined {
    return events.at(-1);
}

export const images = {
    'winner': require('./winner.webp'),
    'loser': require('./loser.webp'),
    'none': null
};