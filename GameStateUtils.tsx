export interface GameState {
    isRunning: boolean,
    isWinner: boolean,
    isLoser: boolean,
    display: string
  }

export const GameStates = {
    RUNNING: { isRunning: true, isWinner: false, isLoser: false, display: 'none' },
    WON: { isRunning: false, isWinner: true, isLoser: false, display: 'winner' },
    LOST: { isRunning: false, isWinner: false, isLoser: true, display: 'loser' },
    RESET: { isRunning: false, isWinner: false, isLoser: false, display: 'none' },
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