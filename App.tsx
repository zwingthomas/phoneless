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

  interface GameState {
    isRunning: boolean,
    isWinner: boolean,
    isLoser: boolean
  }

  class EventType {
    static locked = new EventType('locked')
    static unlocked = new EventType('unlocked')
    static powerup = new EventType('powerup')
    #value

    constructor(value) {
      this.#value = value
    } 

    toString() {
      return this.#value
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
  });

  const tracker = useRef<Tracker>({ events: [] }).current;

  useEffect(() => {
    const eventEmitter = new NativeEventEmitter(NativeModules.LockUnlockEventsEmitter);

    const lockListener = eventEmitter.addListener('lock', () => {
      console.log(`Running: ${gameState.isRunning}`);
      console.log("lock event recieved")
      if (gameState.isRunning && !lastRecordIsLocked()) {
        const event: Event = {
          time: Date.now(),
          eventType: 'lock'
        };
        tracker.events.push(event)
        PushNotificationIOS.removePendingNotificationRequests(["loseTime"]);
        if (!gameState.isLoser && !gameState.isWinner){
          PushNotificationIOS.addNotificationRequest({
            id: "winTime",
            title: "You won!",
            body: "Congrats on putting your phone down!",
            fireDate: new Date(lockGoal - calculateTiming()[2] + Date.now()),
          });
        }
      }
    });

    const unlockListener = eventEmitter.addListener('unlock', () => {
      console.log(`Running: ${gameState.isRunning}`);
      console.log("unlock event recieved")
      if (gameState.isRunning && lastRecordIsLocked()) {
        const event: Event = {
          time: Date.now(),
          eventType: 'unlock'
        };
        tracker.events.push(event)
        PushNotificationIOS.removePendingNotificationRequests(["winTime"]);
        const lockedDuration = (Date.now() - tracker.locked[tracker.locked.length-1]) / 1000;
        console.log(`Locked Duration: ${lockedDuration} seconds`); 
        if (!gameState.isLoser && !gameState.isWinner) {
          PushNotificationIOS.addNotificationRequest({
            id: "loseTime",
            title: "You lose!",
            body: "Put your darn phone down!", 
            fireDate: new Date(tracker.unlocked[0] + lockGrace + calculateTiming()[2]),
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
    setGameState({ isRunning: true, isWinner: false, isLoser: false });
    const event: Event = {
          time: Date.now(),
          eventType: 'unlock'
        };
    tracker.events.push(event)
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
    return lastEvent.eventType === 'locked'
  }

  function won(): [] {
    setGameState({
      isRunning: false,
      isWinner: true,
      isLoser: false
    });
  }

  function lost(): [] {
    setGameState({
      isRunning: false,
      isWinner: false,
      isLoser: true
    });
  }


  function calculateTiming(): [boolean, number, number] {
    // locked   locked    locked  Date.now()
    // unlocked unlocked  unlocked  unlocked
    /*
    // let trackerEdited = false
    if (tracker.locked.length < tracker.unlocked.length) {
      tracker.locked.push(Date.now())
      trackerEdited = true
    }

    let i = 0
    let gameover = false
    let gracetime = lockGrace
    let total_locked_time = 0
    let total_unlocked_time = 0
    while (i < tracker.locked.length) {
      total_unlocked_time += tracker.locked[i] - tracker.unlocked[i]
      gracetime = lockGrace - total_unlocked_time
      if (total_unlocked_time > lockGrace) {
        gameover = true
        break
      }
      if (i + 1 == tracker.unlocked.length){
        break
      }
      total_locked_time += tracker.unlocked[i + 1] - tracker.locked[i]
      if (total_locked_time > lockGoal) {
        gameover = true
        break
      }
      i += 1
    }

    if (trackerEdited) {
      tracker.locked.pop()
    }
    */
    gameover = false
    total_locked_time = 0
    total_unlocked_time = 0
    current_unlock = tracker.events[0].time 
    current_locked = tracker.events[0].time 

    for(const event of tracker.events) {
      switch(event.eventType) {
        case 'unlock':
          total_locked_time += event.time - current_locked
          if (total_locked_time > lockGoal) {
            console.log("HERE: " + total_locked_time)
            gameover = true
            break
          }
          current_unlock = event.time 
        case 'lock':
          total_unlocked_time += event.time - current_unlock
          if (total_unlocked_time > lockGrace) {
            gameover = true
            break
          }
          current_locked = event.time
        case 'powerup':
          total_unlocked_time = total_unlocked_time / 2
      }
    }

    if (!gameover && tracker.events[tracker.events.length - 1].eventType === 'unlock') {
      total_unlocked_time += Date.now() - current_locked
      if (total_unlocked_time > lockGrace) {
        gameover = true
      }
    }

    return [gameover, Math.max(0, lockGrace - total_unlocked_time), total_locked_time]
  }

  useEffect(() => {  
    let determineOutcomeInterval: any;
    if (gameState.isRunning && !lastRecordIsLocked()) {
      console.log("Running Interval")
      determineOutcomeInterval = setInterval(() => {
        // returns boolean for if game is over, and integer with gracetime remaining after game won, or if zero or less, then game lost
        let [gameover, gracetime, lockTime] = calculateTiming()
        // console.log(gracetime)
        if (gameover) {
            if (gracetime > 0) {
              won()
            }
            else {
              lost()
            }
        }
        else {
          setGraceRemaining(gracetime);
        }
      }, 1000);
    } else if (!lastRecordIsLocked()) {
      clearInterval(determineOutcomeInterval);
      PushNotificationIOS.removePendingNotificationRequests(["loseTime", "winTime"]);
    }
    return () => {
      if (determineOutcomeInterval) {
        clearInterval(determineOutcomeInterval);
      }
    };
  }, [gameState.isRunning]);

  const handleResetPress = () => {
    setGameState({ isRunning: false, isWinner: false, isLoser: false });
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
      <Text>Time Phone Was Locked: {Math.round(lockTime / 1000)}</Text>
      <Text>Grace Time Remaining: {Math.round(Math.max(0, graceRemaining / 1000))}</Text>
      {gameState.isLoser && <Image source={require('./loser.webp')} style={styles.resultsImage} />}
      {gameState.isWinner && <Image source={require('./winner.webp')} style={styles.resultsImage} />}
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
