//#import "AppDelegate.h"
//
//#import <React/RCTBundleURLProvider.h>
//
//@implementation AppDelegate
//
//- (BOOL)application:(UIApplication *)application didFinishLaunchingWithOptions:(NSDictionary *)launchOptions
//{
//  self.moduleName = @"phoneless";
//  // You can add your custom initial props in the dictionary below.
//  // They will be passed down to the ViewController used by React Native.
//  self.initialProps = @{};
//
//  return [super application:application didFinishLaunchingWithOptions:launchOptions];
//}
//
//- (NSURL *)sourceURLForBridge:(RCTBridge *)bridge
//{
//#if DEBUG
//  return [[RCTBundleURLProvider sharedSettings] jsBundleURLForBundleRoot:@"index"];
//#else
//  return [[NSBundle mainBundle] URLForResource:@"main" withExtension:@"jsbundle"];
//#endif
//}
//
//@end

#import "AppDelegate.h"

#import <React/RCTBundleURLProvider.h>
#import <React/RCTBridge.h>
#import <React/RCTRootView.h>

@implementation AppDelegate

- (BOOL)application:(UIApplication *)application didFinishLaunchingWithOptions:(NSDictionary *)launchOptions
{
  RCTBridge *bridge = [[RCTBridge alloc] initWithDelegate:self launchOptions:launchOptions];
  RCTRootView *rootView = [[RCTRootView alloc] initWithBridge:bridge
                                                   moduleName:@"phoneless"
                                            initialProperties:nil];

  rootView.backgroundColor = [[UIColor alloc] initWithRed:1.0f green:1.0f blue:1.0f alpha:1];

  self.window = [[UIWindow alloc] initWithFrame:[UIScreen mainScreen].bounds];
  UIViewController *rootViewController = [UIViewController new];
  rootViewController.view = rootView;
  self.window.rootViewController = rootViewController;
  [self.window makeKeyAndVisible];
  return YES;
}

- (NSURL *)sourceURLForBridge:(RCTBridge *)bridge
{
#if DEBUG
  return [[RCTBundleURLProvider sharedSettings] jsBundleURLForBundleRoot:@"index"];
#else
  return [[NSBundle mainBundle] URLForResource:@"main" withExtension:@"jsbundle"];
#endif
}

@end
