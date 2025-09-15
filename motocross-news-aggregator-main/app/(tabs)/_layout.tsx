import { Tabs } from "expo-router";
import { Home, Bookmark, Settings, Play, Headphones } from "lucide-react-native";
import React from "react";

import Colors from "@/constants/colors";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors.light.primary,
        headerShown: true,
        tabBarStyle: {
          backgroundColor: Colors.light.background,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "News",
          tabBarIcon: ({ color }) => <Home color={color} size={24} />,
          headerStyle: {
            backgroundColor: Colors.light.primary,
          },
          headerTintColor: "#fff",
        }}
      />
      <Tabs.Screen
        name="youtube"
        options={{
          title: "Videos",
          tabBarIcon: ({ color }) => <Play color={color} size={24} />,
          headerStyle: {
            backgroundColor: Colors.light.primary,
          },
          headerTintColor: "#fff",
        }}
      />
      <Tabs.Screen
        name="podcasts"
        options={{
          title: "Podcasts",
          tabBarIcon: ({ color }) => <Headphones color={color} size={24} />,
          headerStyle: {
            backgroundColor: Colors.light.primary,
          },
          headerTintColor: "#fff",
        }}
      />
      <Tabs.Screen
        name="bookmarks"
        options={{
          title: "Bookmarks",
          tabBarIcon: ({ color }) => <Bookmark color={color} size={24} />,
          headerStyle: {
            backgroundColor: Colors.light.primary,
          },
          headerTintColor: "#fff",
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ color }) => <Settings color={color} size={24} />,
          headerStyle: {
            backgroundColor: Colors.light.primary,
          },
          headerTintColor: "#fff",
        }}
      />
    </Tabs>
  );
}