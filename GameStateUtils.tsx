export interface GameState {
    isRunning: boolean,
    isWinner: boolean,
    isLoser: boolean,
    display: string,
    sessionId?: string
  }

export const GameStates = {
    RUNNING: (sessionId: string) => ({ isRunning: true, isWinner: false, isLoser: false, display: 'none', sessionId: sessionId }),
    WON: (sessionId: string) => ({ isRunning: false, isWinner: true, isLoser: false, display: 'winner', sessionId: sessionId }),
    LOST: (sessionId: string) => ({ isRunning: false, isWinner: false, isLoser: true, display: 'loser', sessionId: sessionId }),
    RESET: () => ({ isRunning: false, isWinner: false, isLoser: false, display: 'none', sessionId: undefined}),
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