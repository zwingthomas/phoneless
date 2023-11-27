import React, { useState, useEffect, useRef } from 'react';
import { SafeAreaView, Text, View, Image, TouchableOpacity, StyleSheet, NativeEventEmitter, NativeModules } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import PushNotificationIOS from '@react-native-community/push-notification-ios';

const App = () => {

  PushNotificationIOS.requestPermissions()

  const [timer, setTimer] = useState(0);
  const [secondTimer, setSecondTimer] = useState(0);
  const [winTime, setWinTime] = useState(0);
  const [loseTime, setLoseTime] = useState(0);
  const [running, setRunning] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const lockedTimeRef = useRef(Date.now());
  const startTimeRef = useRef(Date.now())
  const secondTimerIntervalRef = useRef<number | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [lockGoal, setLockGoal] = useState(0); // Default value for number 1
  const [lockGrace, setLockGrace] = useState(0); // Default value for number 2
  const [isWinner, setIsWinner] = useState(false);
  const [isLoser, setIsLoser] = useState(false);

  useEffect(() => {
    const eventEmitter = new NativeEventEmitter(NativeModules.LockUnlockEventsEmitter);

    const lockListener = eventEmitter.addListener('lock', () => {
      console.log(`Running: ${running}`);
      console.log("lock event recieved")
      if (running) {
        setIsLocked(true);
        PushNotificationIOS.removePendingNotificationRequests(["loseTime"]);
        lockedTimeRef.current = Date.now(); // Store the lock time in the ref
        if (lockedTimeRef.current > startTimeRef.current + ((lockGoal * 60) + (lockGrace * 60)) * 1000){
          setIsLoser(true)
        }
        else{
          // Set the win time by clock as well and notify them if they reach that time
          PushNotificationIOS.addNotificationRequest({
            id: "winTime",
            title: "You won!",
            body: "Congrats on putting your phone down!",
            fireDate: new Date(startTimeRef.current + (lockGoal * 60 * 1000)),
          });
        }
      }
    });

    const unlockListener = eventEmitter.addListener('unlock', () => {
      console.log(`Running: ${running}`);
      console.log("unlock event recieved")
      if (running) {
        PushNotificationIOS.removePendingNotificationRequests(["winTime"]);
        const lockedDuration = (Date.now() - lockedTimeRef.current) / 1000; // Calculate the duration using the ref
        console.log(`Locked Duration: ${lockedDuration} seconds`); 
        setTimer((currentTimer) => {
          const newTimer = currentTimer + lockedDuration;
          console.log(`Timer is now: ${newTimer}`);
          if (newTimer >= (lockGoal * 60)) {
            setIsWinner(true)
          }
          else if (lockedTimeRef.current > startTimeRef.current + ((lockGoal * 60) + (lockGrace * 60)) * 1000){
            setIsLoser(true)
          }
          else{
            // Set the win time by clock as well and notify them if they reach that time
            PushNotificationIOS.addNotificationRequest({
              id: "loseTime",
              title: "You lose!",
              body: "Put your darn phone down!",
              fireDate: new Date(Date.now() + (((lockGoal * 60 + lockGrace * 60) - newTimer) * 1000)),
            });
          }
          return newTimer;
        });// Use the functional update to ensure the latest timer value is used
      }
    });

    return () => {
      lockListener.remove();
      unlockListener.remove();
    };
  }, [running, startTimeRef, lockGoal, lockGrace]);

  useEffect(() => {
    console.log(`Timer updated to: ${timer} seconds`);
  }, [timer]);

  const handleStartPress = () => {
    setRunning(true);
    console.log(`Running: ${running}`)
    startTimeRef.current = Date.now();
    setSecondTimer(0); // Reset the second timer
    // Start the second timer
    secondTimerIntervalRef.current = setInterval(() => {
      setSecondTimer(t =>  t + 1);
    }, 1000) as unknown as number; // Cast to number, which is the expected type in React Native
  };

  useEffect(() => {
    console.log(`Running updated to: ${running}`);
  }, [running]);

  useEffect(() => {
    // Stop counting up once they win
    return () => {
      if (secondTimerIntervalRef.current !== null) {
        clearInterval(secondTimerIntervalRef.current);
      }
    };
  }, [isWinner]);

  useEffect(() => {
    // Clear interval on unmount or other cleanup conditions
    return () => {
      if (secondTimerIntervalRef.current !== null) {
        clearInterval(secondTimerIntervalRef.current);
      }
    };
  }, []);

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
    // Reset both timers
    setTimer(0);
    setSecondTimer(0);
    setRunning(false); 
    setIsWinner(false);
    setIsLoser(false);
    // Show the Start button again
    PushNotificationIOS.removeDeliveredNotifications(["winTime", "loseTime"]);
    // Clear the second timer interval if it's running
    if (secondTimerIntervalRef.current !== null) {
      clearInterval(secondTimerIntervalRef.current);
      secondTimerIntervalRef.current = null;
    }
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
              <Text>Goal Minutes:</Text>
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
      <Text>Second Timer: {secondTimer} seconds</Text>
      {isWinner && <Image source={require('./winner.webp')} style={styles.winnerImage} />}
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
  winnerImage: {
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