import React, { useState, useEffect, useRef } from 'react';
import { SafeAreaView, Text, NativeEventEmitter, NativeModules } from 'react-native';

const App = () => {
  const [timer, setTimer] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const startTimeRef = useRef(Date.now());

  useEffect(() => {
    console.log('App useEffect run');
    
    const eventEmitter = new NativeEventEmitter(NativeModules.LockUnlockEventsEmitter);

    const lockListener = eventEmitter.addListener('lock', () => {
      console.log('Lock event received');
      setIsLocked(true);
      startTimeRef.current = Date.now(); // Store the lock time in the ref
    });

    const unlockListener = eventEmitter.addListener('unlock', () => {
      console.log('Unlock event received');
      const lockedDuration = (Date.now() - startTimeRef.current) / 1000; // Calculate the duration using the ref
      console.log(`Locked duration: ${lockedDuration} seconds`);
      setIsLocked(false);
      setTimer((currentTimer) => currentTimer + lockedDuration); // Use the functional update to ensure the latest timer value is used
    });

    return () => {
      lockListener.remove();
      unlockListener.remove();
      console.log("test")
    };
  }, []);

  return (
    <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Text>Time Phone Was Locked: {isLocked ? "Locked..." : `${timer.toFixed(2)} seconds`}</Text>
    </SafeAreaView>
  );
};

export default App;