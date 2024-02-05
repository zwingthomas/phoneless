import { TextInput } from 'react-native';
import 'react-native-get-random-values';
import { PieChart } from 'react-native-chart-kit';
import { v4 as uuidv4 } from 'uuid';
import { Picker } from '@react-native-picker/picker';
import React, { useState, useEffect, useRef } from 'react';
import PushNotificationIOS from '@react-native-community/push-notification-ios';
import { GameState, GameStates, EventType, Event, FirebaseEvent, SessionRow, Tracker, getLastEvent, images } from './GameStateUtils';
import { SafeAreaView, Dimensions, Text, View, Image, TouchableOpacity, StyleSheet, NativeEventEmitter, NativeModules } from 'react-native';

// SQLite
import SQLite, { SQLiteDatabase, ResultSet, Transaction } from 'react-native-sqlite-storage';

SQLite.enablePromise(true);

const database_name = "SQLiteDB.db";

let db: SQLiteDatabase | null = null;

// Define your database configuration
const databaseConfig = {
  name: database_name,
  location: 'default',
};

// Open the database
SQLite.openDatabase(databaseConfig).then((DB: SQLiteDatabase) => {
  db = DB;
  console.log("Database OPEN");
  db.executeSql('CREATE TABLE IF NOT EXISTS Sessions (sessionId PRIMARY KEY, userId, winner, startTime, events TEXT)').then(() => {
    console.log("Table created successfully");
  }).catch((error: any) => {
    console.log("Error creating table:", error);
  });
  db.executeSql('CREATE TABLE IF NOT EXISTS Events (id INTEGER PRIMARY KEY AUTOINCREMENT, sessionId, eventType, time)').then(() => {
    console.log("Events table created successfully");
  }).catch((error: any) => console.log(error));
}).catch((error: any) => {
  console.log("Error opening database:", error);
});

const App = () => {

  PushNotificationIOS.requestPermissions()
  const [showSettings, setShowSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [historyData, setHistoryData] = useState({
    winCount: 0,
    lossCount: 0
  });
  const [username, setUsername] = useState("default");
  const [lockGoal, setLockGoal] = useState(0); // Default value for number 1
  const [lockGrace, setLockGrace] = useState(0); // Default value for number 2
  const [graceRemaining, setGraceRemaining] = useState(lockGrace);
  const [lockTime, setLockTime] = useState(0);
  const [gameState, setGameState] = useState<GameState>(GameStates.RESET());
  const startTime = useRef<number | null>(null);

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
        addEventToSession(lockedEvent)
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
        addEventToSession(unlockEvent)
        PushNotificationIOS.removePendingNotificationRequests(["winTime"]);
        if (startTime.current) {
          PushNotificationIOS.addNotificationRequest({
            id: "loseTime",
            title: "You lose!",
            body: "Put your darn phone down!", 
            fireDate: new Date(startTime.current + lockGrace + lockTime),
          });
        }
      }
    });

    return () => {
      lockListener.remove();
      unlockListener.remove();
    };
  }, [gameState]);

  const addEventToSession = (event: Event) => {
    if (gameState.sessionId && username) {
      const insertEventQuery = `INSERT INTO Events (sessionId, eventType, time) VALUES (?, ?, ?)`;
  
      if (db) {
        // Insert the event into the Events table
        db.executeSql(insertEventQuery, [gameState.sessionId, event.eventType.getValue(), event.time], (tx: Transaction, results: ResultSet) => {
          console.log('Event inserted successfully');
        }, (tx: Transaction, error: any) => {
          console.error('Error inserting event:', error);
        });
      } else {
        console.log("Database not initialized");
      }
    }
  };
  
  const updateSessionResult = (sessionId: string, winner: boolean) => {
    const updateQuery = `UPDATE Sessions SET winner = ? WHERE sessionId = ?`;
    if (db) {db.executeSql(updateQuery, [winner, sessionId]);}
    else {console.log("Database not initialized");}
  };

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


  useEffect(() => { 
    if (gameState.isRunning) {
      if (lockTime >= lockGoal) { 
        setGameState(previousState => {
          if (previousState.sessionId && previousState.userId) {
            updateSessionResult(previousState.sessionId, true); // Update session as won
            return GameStates.WON(previousState.sessionId, previousState.userId);
          } else {
            console.error('Session ID or User ID is undefined in WON state');
            return GameStates.RESET();
          }
        });
      } else if (graceRemaining <= 0) { 
        setGameState(previousState => {
          if (previousState.sessionId && previousState.userId) {
            updateSessionResult(previousState.sessionId, false); // Update session as lost
            return GameStates.LOST(previousState.sessionId, previousState.userId);
          } else {
            console.error('Session ID or User ID is undefined in LOST state');
            return GameStates.RESET();
          }
        });
      }
    }
  }, [gameState.isRunning, lockTime, graceRemaining]);

  type EventTypeKey = keyof typeof EventType;

  function isEventTypeKey(value: any): value is EventTypeKey {
    return value in EventType;
  }

  // Runs once a second when game is running, calculates time phone is locked and unlocked and updates state
  // Runs once a second when game is running, calculates time phone is locked and unlocked and updates state
  const calculateTiming = () => {
    const { sessionId, userId } = gameState;
    if (!sessionId || !userId) return;
  
    // Fetch events from SQLite database
    if (db) {
      db.transaction((tx: Transaction) => {
        tx.executeSql(
          `SELECT * FROM Events WHERE sessionId = ? ORDER BY time ASC`, [sessionId],
          (tx: Transaction, results: ResultSet) => {
            const len = results.rows.length;
            console.log(len)
            if (len > 0) {
              const events = [];
              for (let i = 0; i < len; i++) {
                let row = results.rows.item(i);
                if (isEventTypeKey(row.eventType)) {
                  const eventType = EventType[row.eventType as keyof typeof EventType];
                  events.push({
                    time: row.time,
                    eventType: eventType,
                  });
                } else {
                  console.error(`Invalid event type: ${row.eventType}`);
                }
              }
  
              let gameOver = false;
              let total_locked_time = 0;
              let total_unlocked_time = 0;
              let last_event = null;

              for (const event of events) {
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

              let latestEvent = getLastEvent(events);
              if (!gameOver && latestEvent !== undefined && (latestEvent.eventType.getValue() === EventType.unlocked.getValue() || latestEvent.eventType.getValue() === EventType.start.getValue())) {
                total_unlocked_time += Date.now() - latestEvent.time;
              }

              setLockTime(total_locked_time);
              setGraceRemaining(lockGrace - total_unlocked_time);
            }
          },
          (error: any) => {
            console.error(error);
          }
        );
      });
    }
    else {console.log("Database not initialized");}
  };

  const handleStartPress = () => {
    console.log("Game started!")
    const sessionId = uuidv4();
    setGameState(GameStates.RUNNING(sessionId, username));
    
    startTime.current = Date.now();
  
    // Create a new session in the SQLite database
    if (db) {
      db.transaction((tx: Transaction) => {
        // Insert the session into the Sessions table
        tx.executeSql(
          'INSERT INTO Sessions (sessionId, userId, startTime, winner) VALUES (?, ?, ?, ?)',
          [sessionId, username, startTime.current, 0],
          (tx: Transaction, results: ResultSet) => {
            console.log('Session inserted successfully');
          },
          (tx: Transaction, error: any) => {
            console.error('Error inserting session:', error);
          }
        );
    
        // Insert the initial event into the Events table
        tx.executeSql(
          'INSERT INTO Events (sessionId, eventType, time) VALUES (?, ?, ?)',
          [sessionId, EventType.start.getValue(), startTime.current],
          (tx: Transaction, results: ResultSet) => {
            console.log('Event inserted successfully');
          },
          (tx: Transaction, error: any) => {
            console.error('Error inserting event:', error);
          }
        );
      });
    } else {
      console.log("Database not initialized");
    }
  
    setGraceRemaining(lockGrace);
    setLockTime(0);
  
    PushNotificationIOS.addNotificationRequest({
      id: "loseTime",
      title: "You lose!",
      body: "Put your darn phone down!",
      fireDate: new Date(startTime.current + lockGrace),
    });
  };

  const handleResetPress = () => {
    setGameState(GameStates.RESET());
    setLockTime(0);
    setGraceRemaining(0);
    startTime.current = null;
    PushNotificationIOS.removeDeliveredNotifications(["winTime", "loseTime"]);
  };

  const handleHistoryPress = async () => {
    if (!showHistory) {
      const selectQuery = `SELECT * FROM Sessions WHERE userId = ?`;
      if (db) {
        db.executeSql(selectQuery, [username]).then(([results]: [ResultSet]) => {
          const sessions: SessionRow[] = [];
          for (let i = 0; i < results.rows.length; i++) {
            const session = results.rows.item(i) as SessionRow;
            sessions.push(session);
          }

          const winCount = sessions.filter(session => session.winner).length;
          let lossCount = sessions.length - winCount - (gameState.isRunning ? 1 : 0);
    
          setHistoryData({ winCount, lossCount });
          setShowHistory(!showHistory);

        }).catch((error: any) => {
          console.error('Error fetching sessions:', error);
        });
      }
      else {
        console.log("Database not initialized");
      }
    } else {
      setShowHistory(!showHistory);
    }
  };

  const chartConfig = {
    backgroundColor: '#ffffff',
    backgroundGradientFrom: '#ffffff',
    backgroundGradientTo: '#ffffff',
    decimalPlaces: 2, // specify the number of decimal places you want on your chart.
    color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`, // this is a function that returns a color. It is used for the chart lines and labels
    labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`, // this is for the text labels color
    style: {
      borderRadius: 16,
    },
    propsForDots: {
      r: '6',
      strokeWidth: '2',
      stroke: '#ffa726',
    },
  };
  
  const pieData = [
    { name: 'Wins', count: historyData.winCount, color: 'green', legendFontColor: '#7F7F7F', legendFontSize: 15 },
    { name: 'Losses', count: historyData.lossCount, color: 'red', legendFontColor: '#7F7F7F', legendFontSize: 15 },
  ];
  

  return (
    <SafeAreaView style={styles.container}>
      <TouchableOpacity style={styles.settingsButton} onPress={() => setShowSettings(!showSettings)}>
        <Text style={styles.buttonText}>Settings</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.historyButton} onPress={() => handleHistoryPress()}>
        <Text style={styles.buttonText}>History</Text>
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

      {showHistory && (historyData.lossCount != 0 || historyData.winCount != 0) && (
        <View style={styles.settingsDropdown}>
          <PieChart
            data={pieData}
            width={Dimensions.get('window').width}
            height={220}
            chartConfig={chartConfig}
            accessor={"count"}
            backgroundColor={"transparent"}
            paddingLeft={"15"}
            center={[10, 50]}
            absolute
          />
        </View>
      )}
      {showHistory && (historyData.lossCount == 0 && historyData.winCount == 0) && (
        <View style={styles.settingsDropdown}>
          <Text>No data available.</Text>
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
      <TextInput
        style={styles.input}
        onChangeText={setUsername}
        value={username}
        placeholder="Enter your name"
      />
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
  historyButton: {
    position: 'absolute',
    top: 50,
    right: 125,
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
  input: {
    height: 40,
    margin: 12,
    borderWidth: 1,
    padding: 10,
    color: 'black',
    backgroundColor: 'white',
    borderRadius: 5,
  },
});

export default App;
