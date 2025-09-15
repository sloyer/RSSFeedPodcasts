import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { AlertCircle, RefreshCw } from "lucide-react-native";
import { TouchableOpacity } from "react-native-gesture-handler";

import Colors from "@/constants/colors";

interface EmptyStateProps {
  type: "empty" | "error" | "loading" | "support";
  message: string;
  onRefresh?: () => void;
}

const EmptyState: React.FC<EmptyStateProps> = ({ type, message, onRefresh }) => {
  return (
    <View style={styles.container} testID="empty-state">
      {type === "error" || type === "support" ? (
        <AlertCircle size={48} color={Colors.light.error} />
      ) : (
        <RefreshCw size={48} color={Colors.light.placeholder} />
      )}
      <Text style={styles.message}>{message}</Text>
      
      {type === "support" ? (
        <View style={styles.supportContainer}>
          <Text style={styles.supportText}>Please contact support for assistance.</Text>
        </View>
      ) : type !== "loading" && onRefresh && (
        <TouchableOpacity style={styles.button} onPress={onRefresh}>
          <Text style={styles.buttonText}>Refresh</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  message: {
    fontSize: 16,
    color: Colors.light.text,
    textAlign: "center",
    marginTop: 16,
    marginBottom: 24,
  },
  button: {
    backgroundColor: Colors.light.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  supportContainer: {
    marginTop: 8,
  },
  supportText: {
    fontSize: 14,
    color: Colors.light.placeholder,
    textAlign: "center",
    fontStyle: "italic",
  },
});

export default EmptyState;