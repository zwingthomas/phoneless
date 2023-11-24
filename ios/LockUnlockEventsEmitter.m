//
//  LockUnlockEventsEmitter.m
//  phoneless
//
//  Created by Thomas Zwinger on 11/22/23.
//

#import <Foundation/Foundation.h>

// LockUnlockEventsEmitter.m
#import "LockUnlockEventsEmitter.h"

@implementation LockUnlockEventsEmitter

RCT_EXPORT_MODULE();

+ (BOOL)requiresMainQueueSetup {
    return YES; // return YES if initialization must be done on the main thread
}

- (NSArray<NSString *> *)supportedEvents {
  return @[@"lock", @"unlock"];
}

// Subscribe for notifications
- (instancetype)init {
  if (self = [super init]) {
    [[NSNotificationCenter defaultCenter] addObserver:self
                                             selector:@selector(didLock)
                                                 name:UIApplicationProtectedDataWillBecomeUnavailable
                                               object:nil];
    [[NSNotificationCenter defaultCenter] addObserver:self
                                             selector:@selector(didUnlock)
                                                 name:UIApplicationProtectedDataDidBecomeAvailable
                                               object:nil];
  }
  return self;
}

- (void)didLock {
  [self sendEventWithName:@"lock" body:@{@"locked": @YES}];
}

- (void)didUnlock {
  [self sendEventWithName:@"unlock" body:@{@"locked": @NO}];
}

// Remember to unsubscribe from notifications
- (void)dealloc {
  [[NSNotificationCenter defaultCenter] removeObserver:self];
}

@end
