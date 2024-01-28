import { Picker } from '@react-native-picker/picker';
import React, { useState, useEffect, useRef } from 'react';
import PushNotificationIOS from '@react-native-community/push-notification-ios';
import { GameState, GameStates, EventType, Event, Tracker, getLastEvent, images } from './GameStateUtils';
import { SafeAreaView, Text, View, Image, TouchableOpacity, StyleSheet, NativeEventEmitter, NativeModules } from 'react-native';


const App = () => {

  PushNotificationIOS.requestPermissions()
  const [showSettings, setShowSettings] = useState(false);
  const [lockGoal, setLockGoal] = useState(0); // Default value for number 1
  const [lockGrace, setLockGrace] = useState(0); // Default value for number 2
  const [graceRemaining, setGraceRemaining] = useState(lockGrace);
  const [lockTime, setLockTime] = useState(0)
  const [gameState, setGameState] = useState<GameState>(GameStates.RESET);
  const tracker = useRef<Tracker>({ events: [] }).current;

  // Track lock and unlock events using an event emitter
  useEffect(() => {
    
    const eventEmitter = new NativeEventEmitter(NativeModules.LockUnlockEventsEmitter);

    const lockListener = eventEmitter.addListener('lock', () => {
      console.log("lock event recieved")
      if (gameState.isRunning) {
        let lockedEvent: Event = {
          time: Date.now(),
          eventType: EventType.locked
        };
        tracker.events.push(lockedEvent)
        PushNotificationIOS.removePendingNotificationRequests(["loseTime"]);
        PushNotificationIOS.addNotificationRequest({
          id: "winTime",
          title: "You won!",
          body: "Congrats on putting your phone down!",
          fireDate: new Date(lockGoal - lockTime + Date.now()),
        });
      }
    });

    const unlockListener = eventEmitter.addListener('unlock', () => {
      console.log("unlock event recieved")
      if (gameState.isRunning) {
        let unlockEvent: Event = {
          time: Date.now(),
          eventType: EventType.unlocked
        };
        tracker.events.push(unlockEvent)
        PushNotificationIOS.removePendingNotificationRequests(["winTime"]);
        let latestEvent = getLastEvent(tracker.events)
        if (latestEvent !== undefined) {
          const lockedDuration = (Date.now() - latestEvent.time) / 1000;
          console.log(`Locked Duration: ${lockedDuration} seconds`);
        }
        PushNotificationIOS.addNotificationRequest({
          id: "loseTime",
          title: "You lose!",
          body: "Put your darn phone down!", 
          fireDate: new Date(tracker.events[0].time + lockGrace + lockTime),
        });
      }
    });

    return () => {
      lockListener.remove();
      unlockListener.remove();
    };
  }, [gameState]);


  // When game is running creates interval that calculates locked and unlocked time. Interval runs every second.
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


  // Determines winning and losing
  useEffect(() => { 
    if (gameState.isRunning) {
      if (lockTime >= lockGoal) { setGameState(GameStates.WON); }
      else if (graceRemaining <= 0) { setGraceRemaining(0); setGameState(GameStates.LOST) }
    }
  }, [gameState.isRunning, lockTime, graceRemaining]);


  // Runs once a second when game is running, calculates time phone is locked and unlocked and updates state
  function calculateTiming(): void {
    
    let gameOver = false;
    let total_locked_time = 0;
    let total_unlocked_time = 0;

    // We added a start event at the time we started the game, initially set these to that in order to cancel out the first event, as it had nothing before it.
    // We want one of lock and one for unlock in order to not require a sequence of lock after unlock after lock after ... and delink lock and unlock from one another.
    let last_event = null;

    for(const event of tracker.events) {
      if (typeof event.eventType.getValue === 'function') {
        switch(event.eventType.getValue()) {
          case EventType.start.getValue():
            last_event = event.time;
            break;
          case EventType.unlocked.getValue():
            if (last_event !== null) {
              total_locked_time += event.time - last_event;
              if (total_locked_time >= lockGoal) { gameOver = true; }
              last_event = event.time 
            }
            break;
          case EventType.locked.getValue():
            if (last_event !== null) {
              total_unlocked_time += event.time - last_event;
              if (total_unlocked_time >= lockGrace) { gameOver = true; }
              last_event = event.time;
            }
            break;
          // do not add last event to anything not related to timekeeping
          case EventType.powerup.getValue():
            total_unlocked_time = total_unlocked_time / 2;
            break;
        }
      } else {
        console.error("Event type is not an EventType instance");
      }
      if (gameOver) {
        break;
      }
    }

    // Get time from when they last unlocked their phone to now, where they are currently looking at the screen
    let latestEvent = getLastEvent(tracker.events);
    if (!gameOver && latestEvent !== undefined && (latestEvent.eventType.getValue() === EventType.unlocked.getValue() || latestEvent.eventType.getValue() === EventType.start.getValue())) {
      total_unlocked_time += Date.now() - latestEvent.time;
    }

    // No return value, everything is handled by updating these two state vars.
    setLockTime(total_locked_time);
    setGraceRemaining(lockGrace - total_unlocked_time);
  }

  const handleStartPress = () => {
    setGameState(GameStates.RUNNING);
    let initialEvent: Event = {
          time: Date.now(),
          eventType: EventType.start
        };
    tracker.events.push(initialEvent);
    setGraceRemaining(lockGrace);
    setLockTime(0);

    PushNotificationIOS.addNotificationRequest({
      id: "loseTime",
      title: "You lose!",
      body: "Put your darn phone down!",
      fireDate: new Date(initialEvent.time + lockGrace),
    });
  };

  const handleResetPress = () => {
    setGameState(GameStates.RESET);
    setLockTime(0);
    setGraceRemaining(0);
    tracker.events.length = 0;
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
