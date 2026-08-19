import React from "react";
import { StyleSheet, Text } from "react-native";

import { fonts, palette } from "../theme/tokens";

type ErrorTextProps = {
  message: string;
};

export default function ErrorText({ message }: ErrorTextProps) {
  return <Text style={styles.text}>{message}</Text>;
}

const styles = StyleSheet.create({
  text: {
    color: palette.danger,
    fontFamily: fonts.bodyRegular,
    fontSize: 13,
    lineHeight: 19,
  },
});
