import React from "react";
import { Pressable, StyleSheet, Text } from "react-native";

import { fonts, palette } from "../theme/tokens";

type Variant = "primary" | "ghost" | "danger";

type AppButtonProps = {
  label: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  style?: object;
};

export default function AppButton({
  label,
  onPress,
  variant = "primary",
  disabled,
  style,
}: AppButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        disabled ? styles.disabled : null,
        pressed ? styles.pressed : null,
        style,
      ]}
    >
      <Text
        style={[
          styles.label,
          variant === "primary" ? styles.primaryLabel : null,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 13,
    paddingHorizontal: 16,
  },
  primary: {
    backgroundColor: palette.primary,
  },
  ghost: {
    borderWidth: 1,
    borderColor: palette.borderSoft,
    backgroundColor: palette.surface,
  },
  danger: {
    borderWidth: 1,
    borderColor: palette.danger,
    backgroundColor: palette.dangerSoft,
  },
  primaryLabel: {
    color: palette.white,
  },
  label: {
    color: palette.textPrimary,
    fontFamily: fonts.bodyBold,
    fontSize: 15,
  },
  disabled: {
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.82,
  },
});
