export const timestampCommand = {
  description: "Toggles timestamps on and off",
  execute: () => {
    if (window.toggleTimestamp) {
      window.toggleTimestamp();
    }
  },
};
