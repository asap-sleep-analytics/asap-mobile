import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { fonts, palette } from "../theme/tokens";

type SectionBadgeProps = {
  label: string;
  color?: string;
};

export default function SectionBadge({
  label,
  color = palette.primary,
}: SectionBadgeProps) {
  return (
    <View
      style={[
        styles.badge,
        { borderColor: `${color}5C`, backgroundColor: `${color}17` },
      ]}
    >
      <Text style={[styles.text, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: "flex-start",
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  text: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
});
