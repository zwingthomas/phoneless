import React, { useState, useEffect, useRef } from 'react';
import { SafeAreaView, Text, View, Image, TouchableOpacity, StyleSheet, NativeEventEmitter, NativeModules } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import PushNotificationIOS from '@react-native-community/push-notification-ios';

const App = () => {

  PushNotificationIOS.requestPermissions()

  const [showSettings, setShowSettings] = useState(false);
  const [lockGoal, setLockGoal] = useState(0); // Default value for number 1
  const [lockGrace, setLockGrace] = useState(0); // Default value for number 2
  const [graceRemaining, setGraceRemaining] = useState(lockGrace);
  const [lockTime, setLockTime] = useState(0)
  const images = {
    'winner': require('./winner.webp'),
    'loser': require('./loser.webp'),
    'none': null
  };

  interface GameState {
    isRunning: boolean,
    isWinner: boolean,
    isLoser: boolean,
    display: string
  }

  class EventType {
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

  type Event = {
    time: number
    eventType: EventType
  }

  type Tracker = {
    events: Event[]
  }

  const [gameState, setGameState] = useState<GameState>({
    isRunning: false,
    isWinner: false,
    isLoser: false,
    display: 'none'
  });

  const tracker = useRef<Tracker>({ events: [] }).current;

  useEffect(() => {
    const eventEmitter = new NativeEventEmitter(NativeModules.LockUnlockEventsEmitter);

    const lockListener = eventEmitter.addListener('lock', () => {
      console.log(`Running: ${gameState.isRunning}`);
      console.log("lock event recieved")
      if (gameState.isRunning && !lastRecordIsLocked()) {
        let lockedEvent: Event = {
          time: Date.now(),
          eventType: EventType.locked
        };
        tracker.events.push(lockedEvent)
        PushNotificationIOS.removePendingNotificationRequests(["loseTime"]);
        if (gameState.isRunning){
          PushNotificationIOS.addNotificationRequest({
            id: "winTime",
            title: "You won!",
            body: "Congrats on putting your phone down!",
            fireDate: new Date(lockGoal - lockTime + Date.now()),
          });
        }
      }
    });

    const unlockListener = eventEmitter.addListener('unlock', () => {
      console.log(`Running: ${gameState.isRunning}`);
      console.log("unlock event recieved")
      if (gameState.isRunning && lastRecordIsLocked()) {
        let unlockEvent: Event = {
          time: Date.now(),
          eventType: EventType.unlocked
        };
        tracker.events.push(unlockEvent)
        PushNotificationIOS.removePendingNotificationRequests(["winTime"]);
        const lockedDuration = (Date.now() - tracker.events[tracker.events.length-1].time) / 1000;
        console.log(`Locked Duration: ${lockedDuration} seconds`); 
        if (gameState.isRunning) {
          PushNotificationIOS.addNotificationRequest({
            id: "loseTime",
            title: "You lose!",
            body: "Put your darn phone down!", 
            fireDate: new Date(tracker.events[0].time + lockGrace + lockTime),
          });
        }
      }
    });

    return () => {
      lockListener.remove();
      unlockListener.remove();
    };
  }, [gameState]);

  const handleStartPress = () => {
    setGameState({ isRunning: true, isWinner: false, isLoser: false, display: 'none' });
    let initialEvent: Event = {
          time: Date.now(),
          eventType: EventType.unlocked
        };
    tracker.events.push(initialEvent)
    console.log(tracker)
    console.log(`Running: ${gameState.isRunning}`);
    setGraceRemaining(lockGrace)
    setLockTime(0)
    // startTimeRef.current = lockedTimeRef.current = Date.now();

    // schedule losing from unlocked notification
    PushNotificationIOS.addNotificationRequest({
      id: "loseTime",
      title: "You lose!",
      body: "Put your darn phone down!",
      fireDate: new Date(tracker.events[0].time + lockGrace),
    });
  };

  function lastRecordIsLocked(): boolean {
    if (tracker.events.length === 0) {
      return false
    }
    const lastEvent = tracker.events[tracker.events.length - 1]
    return lastEvent.eventType === EventType.locked
  }

  function won(): void {
    setGameState({
      isRunning: false,
      isWinner: true,
      isLoser: false,
      display: 'winner'
    });
  }

  function lost(): void {
    setGraceRemaining(0);
    setGameState({
      isRunning: false,
      isWinner: false,
      isLoser: true,
      display: 'loser'
    });
  }

  function reset(): void {
    setGameState({
      isRunning: false,
      isWinner: false,
      isLoser: false,
      display: 'none'
    });
  }


  function calculateTiming(): void {
    
    let won = false;
    let total_locked_time = 0;
    let total_unlocked_time = 0;
    let last_locked = tracker.events[0].time;
    let last_unlocked = tracker.events[0].time;

    for(const event of tracker.events) {
      console.log("EVENTS");
      console.log("Event Type Object:", event.eventType);
      console.log("Is getValue function:", typeof event.eventType.getValue === 'function');
      if (typeof event.eventType.getValue === 'function') {
        switch(event.eventType.getValue()) {
          case EventType.unlocked.getValue():
            total_locked_time += event.time - last_locked;
            console.log("HERE: " + total_locked_time);
            console.log("Total_locked_time" + total_locked_time);
            if (total_locked_time > lockGoal) {
              won = true;
              break;
            }
            last_unlocked = event.time 
            break;
          case EventType.locked.getValue():
            total_unlocked_time += event.time - last_unlocked;
            if (total_unlocked_time > lockGrace) {
              break;
            }
            last_locked = event.time;
            break;
          case EventType.powerup.getValue():
            total_unlocked_time = total_unlocked_time / 2;
            break;
        }
      } else {
        console.error("Event type is not an EventType instance");
      }
    }

    if (!won && tracker.events[tracker.events.length - 1].eventType.getValue() === EventType.unlocked.getValue()) {
      total_unlocked_time += Date.now() - tracker.events[tracker.events.length - 1].time
      console.log("HERE UNLOCKED END: " + total_unlocked_time)
    }
    setLockTime(total_locked_time)
    setGraceRemaining(lockGrace - total_unlocked_time)
  }

  useEffect(() => {  
    let determineOutcomeInterval: any;
    if (gameState.isRunning) {
      console.log("Running Interval")
      determineOutcomeInterval = setInterval(() => {
        calculateTiming();
      }, 1000);
    }
    return () => {
      if (determineOutcomeInterval) {
        clearInterval(determineOutcomeInterval);
      }
    };
  }, [gameState]);

  useEffect(() => {  
    if (lockTime >= lockGoal) {
      won();
    }
    else if (graceRemaining <= 0) {
      lost();
    }
  }, [lockTime, graceRemaining]);


  const handleResetPress = () => {
    reset();
    tracker.events.length = 0;
    setGraceRemaining(0);
    setLockTime(0);
    PushNotificationIOS.removeDeliveredNotifications(["winTime", "loseTime"]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <TouchableOpacity style={styles.settingsButton} onPress={() => setShowSettings(!showSettings)}>
        <Text style={styles.buttonText}>Settings</Text>
      </TouchableOpacity>

      {!gameState.isRunning && (
        <TouchableOpacity style={styles.button} onPress={handleStartPress}>
          <Text style={styles.buttonText}>Start</Text>
        </TouchableOpacity>
      )}

      {showSettings && (
        <View style={styles.settingsDropdown}>
          <View style={styles.pickerContainer}>
            <View style={styles.pickerWrapper}>
              <Text>Goal Seconds:</Text>
              <Picker
                selectedValue={lockGoal / 1000}
                style={styles.picker}
                onValueChange={(itemValue) => setLockGoal(itemValue * 1000)}>
                {[...Array(600).keys()].map((num) => (
                  <Picker.Item key={num} label={`${num}`} value={num} />
                ))}
              </Picker>
            </View>

            <View style={styles.pickerWrapper}>
              <Text>Grace Time:</Text>
              <Picker
                selectedValue={lockGrace / 1000}
                style={styles.picker}
                onValueChange={(itemValue) => setLockGrace(itemValue * 1000)}>
                {[...Array(60).keys()].map((num) => (
                  <Picker.Item key={num} label={`${num}`} value={num} />
                ))}
              </Picker>
            </View>
          </View>
        </View>
      )}
      <TouchableOpacity style={styles.button} onPress={handleResetPress}>
        <Text style={styles.buttonText}>Reset</Text>
      </TouchableOpacity>
      <Text>The Time Phone Was Locked: {Math.round(lockTime / 1000)}</Text>
      <Text>Grace Time Remaining: {Math.round(Math.max(0, graceRemaining / 1000))}</Text>
      {gameState.display !== 'none' && (
        <Image source={images[gameState.display as keyof typeof images]} style={styles.resultsImage} />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 10, // Add some padding around the SafeAreaView
  },
  button: {
    backgroundColor: '#007bff', // A blue background color for the button
    width: '100%', // Full width
    height: 160, // Approximating an inch tall, adjust as necessary
    justifyContent: 'center', // Center the text vertically
    alignItems: 'center', // Center the text horizontally
    marginBottom: 10, // Space between buttons
  },
  buttonText: {
    color: 'white', // White text for better contrast
    fontSize: 20, // Larger text
  },
  resultsImage: {
    width: 300, // Set the width and height according to your image
    height: 300,
    resizeMode: 'contain',
  },
  settingsButton: {
    position: 'absolute',
    top: 50,
    right: 10,
    backgroundColor: '#007bff', // Ensure it's visible
    padding: 10, // Adjust size
    zIndex: 10, // Ensure it's on top
    borderWidth: 1, // For debugging
    borderColor: 'red', // For debugging
  },
  settingsDropdown: {
    position: 'absolute',
    top: '10%',  // Adjust as needed for vertical positioning
    left: '5%',  // Adjust as needed for horizontal positioning
    width: '90%', // Takes up 90% of the screen width
    height: '80%', // Takes up 80% of the screen height
    backgroundColor: 'white', // Or any color that fits your app's theme
    padding: 20,
    zIndex: 2,  // Ensures it's above other components
    borderRadius: 10, // Optional for rounded corners
    elevation: 5,  // Optional for Android shadow
    shadowColor: '#000',  // Optional for iOS shadow
    shadowOffset: { width: 0, height: 2 },  // Optional for iOS shadow
    shadowOpacity: 0.25,  // Optional for iOS shadow
    shadowRadius: 3.84,  // Optional for iOS shadow
  },
  pickerContainer: {
    flexDirection: 'row', // Aligns children side by side
    justifyContent: 'space-around', // Evenly spaces the children
    width: '100%', // Full width of the dropdown
  },
  pickerWrapper: {
    flex: 1, // Each picker takes up equal space
    alignItems: 'center', // Center align the picker and text
  },
  picker: {
    width: '100%', // Adjust as necessary
    // Other styles for the picker
  },
});

export default App;
