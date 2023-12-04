import React, { useState, useEffect, useRef } from 'react';
import { SafeAreaView, Text, View, Image, TouchableOpacity, StyleSheet, NativeEventEmitter, NativeModules } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import PushNotificationIOS from '@react-native-community/push-notification-ios';

const App = () => {

  PushNotificationIOS.requestPermissions()

  const [timer, setTimer] = useState(0);
  const [winTime, setWinTime] = useState(0);
  const [loseTime, setLoseTime] = useState(0);
  const [running, setRunning] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const lockedTimeRef = useRef(Date.now());
  const startTimeRef = useRef(Date.now())
  const [showSettings, setShowSettings] = useState(false);
  const [lockGoal, setLockGoal] = useState(0); // Default value for number 1
  const [lockGrace, setLockGrace] = useState(0); // Default value for number 2
  const [isWinner, setIsWinner] = useState(false);
  const [isLoser, setIsLoser] = useState(false);
  const [graceTimeRemaining, setGraceTimeRemaining] = useState(0)

  useEffect(() => {
    const eventEmitter = new NativeEventEmitter(NativeModules.LockUnlockEventsEmitter);

    const lockListener = eventEmitter.addListener('lock', () => {
      console.log(`Running: ${running}`);
      console.log("lock event recieved")
      setIsLocked(true);
      if (running && !isLoser && !isWinner) {
        PushNotificationIOS.removePendingNotificationRequests(["loseTime"]);
        lockedTimeRef.current = Date.now(); // Store the lock time in the ref
        // Set the win time by clock as well and notify them if they reach that time
        PushNotificationIOS.addNotificationRequest({
          id: "winTime",
          title: "You won!",
          body: "Congrats on putting your phone down!",
          fireDate: new Date(startTimeRef.current + (lockGoal * 1000)),
        });
      }
    });

    const unlockListener = eventEmitter.addListener('unlock', () => {
      console.log(`Running: ${running}`);
      console.log("unlock event recieved")
      setIsLocked(false)
      if (running) {
        PushNotificationIOS.removePendingNotificationRequests(["winTime"]);
        const lockedDuration = (Date.now() - lockedTimeRef.current) / 1000; // Calculate the duration using the ref
        console.log(`Locked Duration: ${lockedDuration} seconds`); 
        setTimer((currentTimer) => {
          const newTimer = currentTimer + lockedDuration;
          console.log(`Timer is now: ${newTimer}`);
          if (!isLoser && !isWinner) {
            PushNotificationIOS.addNotificationRequest({
              id: "loseTime",
              title: "You lose!",
              body: "Put your darn phone down!",
              // Now + Grace time remaining
              // Now + (lockGrace - (total time elapsed [start time - now] - total locked time elapsed))
              //                  Now       +   total grace time  - total unlocked time  
              fireDate: new Date(Date.now() + ((lockGrace * 1000) - (startTimeRef.current - Date.now() - (newTimer * 1000)))),
            });
          }
          else {
            setRunning(false)
          }
          return newTimer;
        });// Use the functional update to ensure the latest timer value is used
      }
    });

    return () => {
      lockListener.remove();
      unlockListener.remove();
    };
  }, [running, startTimeRef, lockGoal, lockGrace, isLoser, isWinner]);

  useEffect(() => {
    console.log(`Timer updated to: ${timer} seconds`);
  }, [timer]);

  const handleStartPress = () => {
    setRunning(true);
    setIsLocked(false);
    console.log(`Running: ${running}`)
    startTimeRef.current = Date.now();
    lockedTimeRef.current = Date.now();

    // schedule losing from unlocked notification
    PushNotificationIOS.addNotificationRequest({
      id: "loseTime",
      title: "You lose!",
      body: "Put your darn phone down!",
      fireDate: new Date(Date.now() + ((lockGrace * 1000) - (startTimeRef.current - Date.now()))),
    });
  };

  useEffect(() => {
    let determine_outcome_interval: any;
    if (running) {
      determine_outcome_interval = setInterval(() => {
        setIsWinner(timer >= lockGoal)
        if (isLocked) {
          setIsLoser(lockGrace - Math.floor((Date.now() / 1000 - (startTimeRef.current / 1000 + timer + (Date.now() - lockedTimeRef.current) / 1000))) <= 0 && timer < lockGoal)
        }
        else {
          setIsLoser(lockGrace - Math.floor((Date.now() / 1000 - (startTimeRef.current / 1000 + timer))) <= 0 && timer < lockGoal)
        }
        setGraceTimeRemaining(lockGrace - Math.floor((Date.now() / 1000 - (startTimeRef.current / 1000 + timer))))
      }, 1000);
    }

    return () => {
      if (determine_outcome_interval) {
        clearInterval(determine_outcome_interval);
      }
    };
  }, [running, timer, lockedTimeRef, isLocked]);

  useEffect(() => {
    console.log(`Running updated to: ${running}`);
  }, [running]);

  // const formatTime = (totalSeconds: number) => {
  //   const hours = Math.floor(totalSeconds / 3600);
  //   const minutes = Math.floor((totalSeconds % 3600) / 60);
  //   const seconds = totalSeconds % 60;

  //   const formattedHours = String(hours).padStart(2, '0');
  //   const formattedMinutes = String(minutes).padStart(2, '0');
  //   const formattedSeconds = String(seconds).padStart(2, '0');

  //   return `${formattedHours}:${formattedMinutes}:${formattedSeconds}`;
  // };


  const handleResetPress = () => {
    setTimer(0);
    setRunning(false); 
    setIsWinner(false);
    setIsLoser(false);
    PushNotificationIOS.removeDeliveredNotifications(["winTime", "loseTime"]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <TouchableOpacity style={styles.settingsButton} onPress={() => setShowSettings(!showSettings)}>
        <Text style={styles.buttonText}>Settings</Text>
      </TouchableOpacity>

      {!running && (
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
                selectedValue={lockGoal}
                style={styles.picker}
                onValueChange={(itemValue) => setLockGoal(itemValue)}>
                {[...Array(600).keys()].map((num) => (
                  <Picker.Item key={num} label={`${num}`} value={num} />
                ))}
              </Picker>
            </View>

            <View style={styles.pickerWrapper}>
              <Text>Grace Time:</Text>
              <Picker
                selectedValue={lockGrace}
                style={styles.picker}
                onValueChange={(itemValue) => setLockGrace(itemValue)}>
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
      <Text>Time Phone Was Locked: {Math.floor(timer)}</Text>
      <Text>Grace Time Remaining: {Math.floor(graceTimeRemaining)}</Text>
      {isLoser && <Image source={require('./loser.webp')} style={styles.resultsImage} />}
      {isWinner && <Image source={require('./winner.webp')} style={styles.resultsImage} />}
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