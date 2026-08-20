import React from "react";
import { StyleSheet, Text, View } from "react-native";

import GlassCard from "./GlassCard";
import { fonts, palette } from "../theme/tokens";

type EmptyStateProps = {
  message: string;
};

export default function EmptyState({ message }: EmptyStateProps) {
  return (
    <GlassCard style={styles.card}>
      <Text style={styles.text}>{message}</Text>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: "center",
    paddingVertical: 26,
  },
  text: {
    color: palette.textSecondary,
    fontFamily: fonts.bodyRegular,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
});
